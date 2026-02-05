#!/usr/bin/env node

/**
 * Git Commit Hook Handler for Commit Context Plugin
 *
 * Called by prepare-commit-msg hook to:
 * 1. Read staged files
 * 2. Load active session and filter to staged files
 * 3. Parse Claude session JSONL for messages
 * 4. Upload to API
 * 5. Append trailers to commit message
 *
 * Usage:
 *   on-commit.js <commit-msg-file> [commit-source] [sha1]
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import https from 'https';
import http from 'http';

const ACC_DIR = join(homedir(), '.acc');
const SESSION_FILE = join(ACC_DIR, 'active-session.json');
const CONFIG_FILE = join(ACC_DIR, 'config.json');
const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Execute a git command safely
 */
function gitCommand(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

/**
 * Load configuration
 */
function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

/**
 * Load active session
 */
function loadSession() {
  if (!existsSync(SESSION_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
}

/**
 * Get staged files
 */
function getStagedFiles() {
  try {
    const output = gitCommand(['diff', '--cached', '--name-only']);
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Find the most recent Claude session JSONL file for current project
 */
function findClaudeSessionFile() {
  try {
    const repoRoot = gitCommand(['rev-parse', '--show-toplevel']);
    const projectName = basename(repoRoot);

    // Claude stores sessions in ~/.claude/projects/<hash>/
    // We need to find the right project folder
    if (!existsSync(CLAUDE_PROJECTS_DIR)) {
      return null;
    }

    const projectDirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => join(CLAUDE_PROJECTS_DIR, d.name));

    // Find most recent .jsonl file across all project dirs
    let mostRecentFile = null;
    let mostRecentTime = 0;

    for (const dir of projectDirs) {
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          path: join(dir, f),
          mtime: existsSync(join(dir, f))
            ? readFileSync(join(dir, f)).length // Use file size as proxy for recency
            : 0
        }));

      for (const file of files) {
        if (file.mtime > mostRecentTime) {
          mostRecentTime = file.mtime;
          mostRecentFile = file.path;
        }
      }
    }

    return mostRecentFile;
  } catch {
    return null;
  }
}

/**
 * Parse JSONL session file and extract messages
 */
function parseSessionFile(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  const messages = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'human' || entry.role === 'user') {
        messages.push({
          role: 'user',
          content: extractTextContent(entry.content || entry.message),
          timestamp: entry.timestamp
        });
      } else if (entry.type === 'assistant' || entry.role === 'assistant') {
        const filesModified = extractFilesFromToolUse(entry);
        messages.push({
          role: 'assistant',
          content: extractTextContent(entry.content || entry.message),
          filesModified,
          timestamp: entry.timestamp
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return messages;
}

/**
 * Extract text content from message content (handles arrays and strings)
 */
function extractTextContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract file paths from tool_use blocks in assistant message
 */
function extractFilesFromToolUse(entry) {
  const files = [];
  const content = entry.content || [];

  if (!Array.isArray(content)) {
    return files;
  }

  for (const block of content) {
    if (block.type === 'tool_use') {
      const input = block.input || {};
      const filePath = input.file_path || input.path;
      if (filePath && !files.includes(filePath)) {
        files.push(filePath);
      }
    }
  }

  return files;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Upload session to API with retry logic
 */
async function uploadSession(session, messages, config, retries = 3) {
  const url = new URL('/api/sessions', config.apiUrl || 'https://ai-commit-context.vercel.app');

  const payload = {
    sessionId: session.sessionId,
    projectName: basename(process.cwd()),
    messages,
    repos: session.repos,
    startedAt: session.startedAt,
    endedAt: new Date().toISOString()
  };

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await makeRequest(url, payload, config.apiKey);

      // Check for auth errors
      if (result.statusCode === 401) {
        throw new AuthError('API key expired or invalid. Run: acc auth login');
      }

      if (result.statusCode === 403) {
        throw new AuthError('Access denied. Check your API key permissions.');
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return result.data;
      }

      // Server error - retry
      if (result.statusCode >= 500) {
        lastError = new Error(`Server error: ${result.statusCode}`);
        if (attempt < retries) {
          await sleep(Math.pow(2, attempt) * 500); // Exponential backoff
          continue;
        }
      }

      throw new Error(`Upload failed: ${result.statusCode}`);
    } catch (err) {
      lastError = err;

      // Don't retry auth errors
      if (err instanceof AuthError) {
        throw err;
      }

      // Network errors - retry with backoff
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        if (attempt < retries) {
          await sleep(Math.pow(2, attempt) * 500);
          continue;
        }
        throw new NetworkError('Cannot connect to server. Check your internet connection.');
      }

      if (attempt >= retries) {
        throw lastError;
      }
    }
  }

  throw lastError;
}

/**
 * Custom error for authentication failures
 */
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Custom error for network failures
 */
class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Make HTTP request
 */
function makeRequest(url, payload, apiKey) {
  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000 // 10 second timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsedData = null;
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = { raw: data };
        }
        resolve({ statusCode: res.statusCode, data: parsedData });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Save session for later upload when offline
 */
function saveForLaterUpload(session, messages) {
  const pendingDir = join(ACC_DIR, 'pending');
  if (!existsSync(pendingDir)) {
    mkdirSync(pendingDir, { recursive: true });
  }

  const filename = `${session.sessionId}.json`;
  const filepath = join(pendingDir, filename);

  writeFileSync(filepath, JSON.stringify({ session, messages }, null, 2));
  console.log(`Session saved for later upload: ${filepath}`);
}

/**
 * Append trailers to commit message
 */
function appendTrailers(commitMsgFile, sessionId, viewerUrl) {
  const content = readFileSync(commitMsgFile, 'utf-8');

  // Check if trailers already exist
  if (content.includes('AI-Context-ID:')) {
    return;
  }

  // Add blank line before trailers if needed
  const trailers = `\nAI-Context-ID: ${sessionId}\nAI-Context-URL: ${viewerUrl}\n`;

  // Append trailers
  appendFileSync(commitMsgFile, trailers);
}

/**
 * Main handler
 */
async function main() {
  const commitMsgFile = process.argv[2];
  const commitSource = process.argv[3]; // e.g., 'message', 'template', 'merge', 'squash', 'commit'

  // Skip for merge, squash, or amend commits
  if (['merge', 'squash', 'commit'].includes(commitSource)) {
    process.exit(0);
  }

  if (!commitMsgFile) {
    console.error('No commit message file provided');
    process.exit(1);
  }

  // Load config and session
  const config = loadConfig();
  if (!config?.apiKey) {
    // No auth - skip silently (user hasn't set up yet)
    process.exit(0);
  }

  const session = loadSession();
  if (!session) {
    // No active session - skip
    process.exit(0);
  }

  // Get staged files
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  // Filter session repos to only include staged files
  const filteredRepos = session.repos.map(repo => ({
    ...repo,
    files: repo.files.filter(f => stagedFiles.includes(f))
  })).filter(repo => repo.files.length > 0);

  if (filteredRepos.length === 0) {
    // No tracked files in this commit
    process.exit(0);
  }

  // Update session with filtered repos
  session.repos = filteredRepos;

  // Find and parse Claude session file
  const claudeFile = findClaudeSessionFile();
  const messages = claudeFile ? parseSessionFile(claudeFile) : [];

  try {
    // Upload session
    const result = await uploadSession(session, messages, config);

    if (result.shortCode) {
      const viewerUrl = `${config.apiUrl || 'https://ai-commit-context.vercel.app'}/s/${result.shortCode}`;
      appendTrailers(commitMsgFile, session.sessionId, viewerUrl);
      console.log(`✓ AI context linked: ${viewerUrl}`);
    }
  } catch (err) {
    // Don't block commit on upload failure, but show helpful messages
    if (err instanceof AuthError) {
      console.error(`⚠ ${err.message}`);
    } else if (err instanceof NetworkError) {
      console.error(`⚠ Offline: ${err.message}`);
      // Save session for later upload
      saveForLaterUpload(session, messages);
    } else {
      console.error(`⚠ AI context upload failed: ${err.message}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(0); // Don't block commit on errors
});
