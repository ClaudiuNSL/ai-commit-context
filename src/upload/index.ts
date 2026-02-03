import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { loadConfig } from '../utils/index.js';
import { getSession, updateSessionUploaded, getSessionFiles } from '../db/index.js';
import { parseSessionFile } from '../parser/index.js';

/**
 * Make an HTTP/HTTPS POST request
 */
function httpPost(url: string, data: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, body });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

interface UploadResult {
  success: boolean;
  url?: string;
  shortCode?: string;
  error?: string;
}

/**
 * Upload a session to the server
 */
export async function uploadSession(sessionId: string): Promise<UploadResult> {
  const config = loadConfig();
  const apiUrl = config.auth.apiUrl || 'https://ai-commit-context.vercel.app';

  // Get session from local DB
  const session = getSession(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found in local database' };
  }

  // Find and parse the original JSONL file
  const messages = await getSessionMessages(sessionId);
  if (!messages) {
    return { success: false, error: 'Could not read session messages' };
  }

  const files = getSessionFiles(sessionId);

  const payload = {
    sessionId: session.id,
    projectName: session.projectName,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() || null,
    messages,
    filesModified: files.map(f => f.filePath),
  };

  const url = `${apiUrl}/api/sessions`;
  const body = JSON.stringify(payload);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    }

    const response = await httpPost(url, body, headers);

    if (response.status !== 200) {
      return { success: false, error: `Server error (${response.status}): ${response.body}` };
    }

    const data = JSON.parse(response.body) as { url?: string; shortCode?: string };

    // Update local database
    if (data.url) {
      updateSessionUploaded(sessionId, data.url);
    }

    return {
      success: true,
      url: data.url,
      shortCode: data.shortCode,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to connect to server: ${errorMsg}`,
    };
  }
}

/**
 * Get session messages from the JSONL file
 */
async function getSessionMessages(sessionId: string): Promise<unknown[] | null> {
  const claudeProjectsPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.claude',
    'projects'
  );

  if (!fs.existsSync(claudeProjectsPath)) {
    return null;
  }

  // Search for the session file
  const projects = fs.readdirSync(claudeProjectsPath);
  for (const project of projects) {
    const projectDir = path.join(claudeProjectsPath, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const files = fs.readdirSync(projectDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(projectDir, file);
      const parsed = await parseSessionFile(filePath);

      if (parsed && parsed.id === sessionId) {
        return parsed.messages;
      }
    }
  }

  return null;
}

/**
 * Link a commit to a remote session
 */
export async function linkCommitRemote(
  sessionCode: string,
  commitSha: string,
  repoUrl: string,
  message: string
): Promise<UploadResult> {
  const config = loadConfig();
  const apiUrl = config.auth.apiUrl || 'https://ai-commit-context.vercel.app';

  try {
    const url = `${apiUrl}/api/sessions/${sessionCode}/commits`;
    const body = JSON.stringify({ sha: commitSha, repoUrl, message });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    }

    const response = await httpPost(url, body, headers);

    if (response.status !== 200) {
      return { success: false, error: `Server error (${response.status}): ${response.body}` };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to connect to server: ${errorMsg}`,
    };
  }
}
