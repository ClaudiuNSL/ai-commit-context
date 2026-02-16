import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getActiveSession, getSessionFiles, insertSessionCommit } from '../db/index.js';

const PREPARE_COMMIT_MSG_HOOK = `#!/bin/sh
# AI Commit Context - prepare-commit-msg hook
# This hook syncs and adds AI context trailers to commit messages

# Sync: scan + upload active session (quiet mode returns URL)
SESSION_URL=$(acc sync --quiet 2>/dev/null)

if [ -n "$SESSION_URL" ]; then
    # Get session ID
    SESSION_ID=$(acc sessions active --format=id 2>/dev/null)

    # Get staged files
    STAGED_FILES=$(git diff --cached --name-only)

    if [ -n "$STAGED_FILES" ] && [ -n "$SESSION_ID" ]; then
        # Check if any staged files were touched by the session
        MATCHED=$(acc sessions check-files "$SESSION_ID" $STAGED_FILES 2>/dev/null)

        if [ -n "$MATCHED" ]; then
            # Append trailers to commit message
            echo "" >> "$1"
            echo "AI-Context-ID: $SESSION_ID" >> "$1"
            echo "AI-Context-URL: $SESSION_URL" >> "$1"
        fi
    fi
fi
`;

const POST_COMMIT_HOOK = `#!/bin/sh
# AI Commit Context - post-commit hook
# This hook links commits to AI sessions

COMMIT_SHA=$(git rev-parse HEAD)
SESSION_ID=$(acc sessions active --format=id 2>/dev/null)

if [ -n "$SESSION_ID" ]; then
    acc sessions link "$SESSION_ID" "$COMMIT_SHA" 2>/dev/null
fi
`;

/**
 * Find the git root directory
 */
export function findGitRoot(startPath?: string): string | null {
  let currentPath = startPath || process.cwd();

  while (currentPath !== path.parse(currentPath).root) {
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Install git hooks in the repository
 */
export function installHooks(repoPath?: string): { success: boolean; message: string } {
  const gitRoot = repoPath || findGitRoot();

  if (!gitRoot) {
    return {
      success: false,
      message: 'Not in a git repository',
    };
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hooks = [
    { name: 'prepare-commit-msg', content: PREPARE_COMMIT_MSG_HOOK },
    { name: 'post-commit', content: POST_COMMIT_HOOK },
  ];

  const installed: string[] = [];
  const skipped: string[] = [];

  for (const hook of hooks) {
    const hookPath = path.join(hooksDir, hook.name);

    // Check if hook already exists
    if (fs.existsSync(hookPath)) {
      const existingContent = fs.readFileSync(hookPath, 'utf-8');
      if (existingContent.includes('AI Commit Context')) {
        skipped.push(hook.name);
        continue;
      }

      // Backup existing hook
      const backupPath = `${hookPath}.backup`;
      fs.copyFileSync(hookPath, backupPath);
    }

    // Write hook
    fs.writeFileSync(hookPath, hook.content, { mode: 0o755 });
    installed.push(hook.name);
  }

  let message = '';
  if (installed.length > 0) {
    message += `Installed hooks: ${installed.join(', ')}`;
  }
  if (skipped.length > 0) {
    message += (message ? '. ' : '') + `Already installed: ${skipped.join(', ')}`;
  }

  return {
    success: true,
    message: message || 'No hooks to install',
  };
}

/**
 * Uninstall git hooks from the repository
 */
export function uninstallHooks(repoPath?: string): { success: boolean; message: string } {
  const gitRoot = repoPath || findGitRoot();

  if (!gitRoot) {
    return {
      success: false,
      message: 'Not in a git repository',
    };
  }

  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  const hookNames = ['prepare-commit-msg', 'post-commit'];
  const removed: string[] = [];

  for (const hookName of hookNames) {
    const hookPath = path.join(hooksDir, hookName);

    if (!fs.existsSync(hookPath)) continue;

    const content = fs.readFileSync(hookPath, 'utf-8');
    if (!content.includes('AI Commit Context')) continue;

    // Check for backup
    const backupPath = `${hookPath}.backup`;
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, hookPath);
      fs.unlinkSync(backupPath);
    } else {
      fs.unlinkSync(hookPath);
    }

    removed.push(hookName);
  }

  return {
    success: true,
    message: removed.length > 0
      ? `Removed hooks: ${removed.join(', ')}`
      : 'No ACC hooks found',
  };
}

/**
 * Link a session to a commit
 */
export function linkSessionToCommit(
  sessionId: string,
  commitSha: string,
  repoPath?: string
): { success: boolean; message: string } {
  const gitRoot = repoPath || findGitRoot();

  if (!gitRoot) {
    return {
      success: false,
      message: 'Not in a git repository',
    };
  }

  try {
    insertSessionCommit({
      sessionId,
      commitSha,
      repoPath: gitRoot,
      createdAt: new Date(),
    });

    return {
      success: true,
      message: `Linked session ${sessionId.substring(0, 8)} to commit ${commitSha.substring(0, 7)}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to link: ${error}`,
    };
  }
}

/**
 * Check if staged files match session files
 */
export function checkStagedFilesMatch(sessionId: string, stagedFiles: string[]): string[] {
  const sessionFiles = getSessionFiles(sessionId);
  const sessionFilePaths = new Set(sessionFiles.map(f => f.filePath));

  return stagedFiles.filter(file => {
    // Check exact match
    if (sessionFilePaths.has(file)) return true;

    // Check if any session file ends with the staged file path
    for (const sessionPath of sessionFilePaths) {
      if (sessionPath.endsWith(file) || file.endsWith(sessionPath)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Get current commit SHA
 */
export function getCurrentCommit(repoPath?: string): string | null {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) return null;

  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: gitRoot,
      encoding: 'utf-8',
    }).trim();
    return sha;
  } catch {
    return null;
  }
}

/**
 * Get staged files
 */
export function getStagedFiles(repoPath?: string): string[] {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) return [];

  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: gitRoot,
      encoding: 'utf-8',
    }).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

/**
 * Get remote origin URL (https form preferred for API)
 */
export function getRepoUrl(repoPath?: string): string {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) return '';

  try {
    const url = execSync('git config --get remote.origin.url', {
      cwd: gitRoot,
      encoding: 'utf-8',
    }).trim();

    // Convert SSH URLs to HTTPS for consistency
    // git@github.com:user/repo.git -> https://github.com/user/repo
    if (url.startsWith('git@')) {
      return url
        .replace(/^git@/, 'https://')
        .replace(/\.com:/, '.com/')
        .replace(/\.git$/, '');
    }

    // Remove .git suffix from HTTPS URLs
    return url.replace(/\.git$/, '');
  } catch {
    return '';
  }
}

/**
 * Get the last commit message
 */
export function getLastCommitMessage(repoPath?: string): string {
  const gitRoot = repoPath || findGitRoot();
  if (!gitRoot) return '';

  try {
    return execSync('git log -1 --pretty=%B', {
      cwd: gitRoot,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}
