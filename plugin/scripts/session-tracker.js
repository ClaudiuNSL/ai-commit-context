#!/usr/bin/env node

/**
 * Session Tracker for Commit Context Plugin
 *
 * Tracks file modifications during Claude Code sessions and maintains
 * state for linking conversations to commits.
 *
 * Usage:
 *   session-tracker.js init     - Initialize new session
 *   session-tracker.js track    - Track file modification (reads from stdin)
 *   session-tracker.js cleanup  - Clean up session state
 *   session-tracker.js get      - Get current session state
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

const ACC_DIR = join(homedir(), '.acc');
const SESSION_FILE = join(ACC_DIR, 'active-session.json');

/**
 * Ensure the .acc directory exists
 */
function ensureAccDir() {
  if (!existsSync(ACC_DIR)) {
    mkdirSync(ACC_DIR, { recursive: true });
  }
}

/**
 * Execute a git command safely using execFileSync
 */
function gitCommand(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

/**
 * Get git repository information for a file path
 */
function getRepoInfo(filePath) {
  try {
    const fileDir = dirname(filePath);

    // Get repo root
    const repoRoot = gitCommand(['rev-parse', '--show-toplevel'], fileDir);

    // Get current branch
    const branch = gitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);

    // Get remote URL and parse owner/name
    let owner = 'local';
    let name = repoRoot.split('/').pop();

    try {
      const remoteUrl = gitCommand(['remote', 'get-url', 'origin'], repoRoot);

      // Parse GitHub URL (SSH or HTTPS)
      const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
      const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);

      if (sshMatch) {
        owner = sshMatch[1];
        name = sshMatch[2];
      } else if (httpsMatch) {
        owner = httpsMatch[1];
        name = httpsMatch[2];
      }
    } catch {
      // No remote configured, use local values
    }

    return { repoRoot, branch, owner, name };
  } catch {
    return null;
  }
}

/**
 * Initialize a new session
 */
function initSession() {
  ensureAccDir();

  const session = {
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    startedAt: new Date().toISOString(),
    repos: [],
    cwd: process.cwd()
  };

  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(JSON.stringify({ status: 'initialized', sessionId: session.sessionId }));
}

/**
 * Track a file modification from tool result
 */
function trackFileModification() {
  // Read tool result from stdin
  let input = '';
  try {
    input = readFileSync(0, 'utf-8');
  } catch {
    // No stdin provided
    console.log(JSON.stringify({ status: 'skipped', reason: 'no input' }));
    return;
  }

  let toolResult;
  try {
    toolResult = JSON.parse(input);
  } catch {
    console.log(JSON.stringify({ status: 'skipped', reason: 'invalid json' }));
    return;
  }

  // Extract file path from tool result
  const filePath = extractFilePath(toolResult);
  if (!filePath) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'no file path' }));
    return;
  }

  // Load current session
  if (!existsSync(SESSION_FILE)) {
    initSession();
  }

  const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));

  // Get repo info for this file
  const repoInfo = getRepoInfo(filePath);
  if (!repoInfo) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'not in git repo' }));
    return;
  }

  // Find or create repo entry
  let repo = session.repos.find(
    r => r.owner === repoInfo.owner && r.name === repoInfo.name
  );

  if (!repo) {
    repo = {
      owner: repoInfo.owner,
      name: repoInfo.name,
      branch: repoInfo.branch,
      repoRoot: repoInfo.repoRoot,
      files: []
    };
    session.repos.push(repo);
  }

  // Add file if not already tracked
  const relativePath = filePath.replace(repoInfo.repoRoot + '/', '');
  if (!repo.files.includes(relativePath)) {
    repo.files.push(relativePath);
  }

  // Update branch (might have changed)
  repo.branch = repoInfo.branch;

  // Save session
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(JSON.stringify({
    status: 'tracked',
    file: relativePath,
    repo: `${repoInfo.owner}/${repoInfo.name}`
  }));
}

/**
 * Extract file path from tool result based on tool type
 */
function extractFilePath(toolResult) {
  if (!toolResult) return null;

  // Handle different tool result structures
  const toolName = toolResult.tool_name || toolResult.name;
  const input = toolResult.input || toolResult.parameters || {};

  switch (toolName) {
    case 'Write':
    case 'Edit':
    case 'Read':
      return input.file_path || input.path;

    case 'Bash': {
      // Try to extract file paths from bash commands
      const command = input.command || '';
      // Look for common patterns: redirections, file arguments
      const redirectMatch = command.match(/>\s*["']?([^"'\s|&;]+)/);
      if (redirectMatch) return redirectMatch[1];

      // Check for common file-modifying commands
      const fileCommandMatch = command.match(/(?:touch|mkdir|cp|mv|rm)\s+(?:-\w+\s+)*["']?([^"'\s|&;]+)/);
      if (fileCommandMatch) return fileCommandMatch[1];

      return null;
    }

    default:
      return input.file_path || input.path || null;
  }
}

/**
 * Get current session state
 */
function getActiveSession() {
  if (!existsSync(SESSION_FILE)) {
    console.log(JSON.stringify({ status: 'no_session' }));
    return null;
  }

  const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  console.log(JSON.stringify(session));
  return session;
}

/**
 * Clean up session state
 */
function clearSession() {
  if (existsSync(SESSION_FILE)) {
    const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    session.endedAt = new Date().toISOString();

    // Archive the session before clearing
    const archiveDir = join(ACC_DIR, 'sessions');
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    const archiveFile = join(archiveDir, `${session.sessionId}.json`);
    writeFileSync(archiveFile, JSON.stringify(session, null, 2));

    // Clear active session
    unlinkSync(SESSION_FILE);

    console.log(JSON.stringify({ status: 'cleaned', archived: archiveFile }));
  } else {
    console.log(JSON.stringify({ status: 'no_session_to_clean' }));
  }
}

// Main CLI handler
const command = process.argv[2];

switch (command) {
  case 'init':
    initSession();
    break;
  case 'track':
    trackFileModification();
    break;
  case 'get':
    getActiveSession();
    break;
  case 'cleanup':
    clearSession();
    break;
  case '--help':
  case '-h':
    console.log(`
Session Tracker for Commit Context Plugin

Usage:
  session-tracker.js init     - Initialize new session
  session-tracker.js track    - Track file modification (reads from stdin)
  session-tracker.js cleanup  - Clean up session state
  session-tracker.js get      - Get current session state
`);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
