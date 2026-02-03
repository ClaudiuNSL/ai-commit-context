import fs from 'fs';
import path from 'path';
import { loadConfig } from '../utils/index.js';
import { getSession, updateSessionUploaded, getSessionFiles } from '../db/index.js';
import { parseSessionFile } from '../parser/index.js';

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
  const apiUrl = config.auth.apiUrl || 'https://aicommitcontext.dev/api';

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

  try {
    const response = await fetch(`${apiUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.auth.token ? { 'Authorization': `Bearer ${config.auth.token}` } : {}),
      },
      body: JSON.stringify({
        sessionId: session.id,
        projectName: session.projectName,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() || null,
        messages,
        filesModified: files.map(f => f.filePath),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Server error: ${error}` };
    }

    const data = await response.json() as { url?: string; shortCode?: string };

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
    return {
      success: false,
      error: `Failed to connect to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  const apiUrl = config.auth.apiUrl || 'https://aicommitcontext.dev/api';

  try {
    const response = await fetch(`${apiUrl}/api/sessions/${sessionCode}/commits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.auth.token ? { 'Authorization': `Bearer ${config.auth.token}` } : {}),
      },
      body: JSON.stringify({ sha: commitSha, repoUrl, message }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Server error: ${error}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to connect to server: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
