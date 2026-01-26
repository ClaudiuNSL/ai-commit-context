import chokidar from 'chokidar';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { parseSessionFile, toSession } from '../parser/index.js';
import { insertSession, insertSessionFile, getSession } from '../db/index.js';
import type { WatcherConfig } from '../types.js';

const DEFAULT_CLAUDE_PATH = path.join(os.homedir(), '.claude', 'projects');

interface WatcherState {
  isRunning: boolean;
  watcher: chokidar.FSWatcher | null;
  processedFiles: Set<string>;
  lastModified: Map<string, number>;
}

const state: WatcherState = {
  isRunning: false,
  watcher: null,
  processedFiles: new Set(),
  lastModified: new Map(),
};

/**
 * Start watching Claude Code session files
 */
export function startWatcher(config?: Partial<WatcherConfig>): void {
  if (state.isRunning) {
    console.log('Watcher is already running');
    return;
  }

  const claudePath = config?.claudeProjectsPath || DEFAULT_CLAUDE_PATH;

  if (!fs.existsSync(claudePath)) {
    console.log(`Claude projects directory not found: ${claudePath}`);
    console.log('Creating directory...');
    fs.mkdirSync(claudePath, { recursive: true });
  }

  console.log(`Starting watcher on: ${claudePath}`);

  state.watcher = chokidar.watch(path.join(claudePath, '**/*.jsonl'), {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

  state.watcher
    .on('add', (filePath) => handleFileChange(filePath, 'add'))
    .on('change', (filePath) => handleFileChange(filePath, 'change'))
    .on('error', (error) => console.error('Watcher error:', error));

  state.isRunning = true;
  console.log('Watcher started successfully');
}

/**
 * Stop the watcher
 */
export async function stopWatcher(): Promise<void> {
  if (!state.isRunning || !state.watcher) {
    console.log('Watcher is not running');
    return;
  }

  await state.watcher.close();
  state.watcher = null;
  state.isRunning = false;
  console.log('Watcher stopped');
}

/**
 * Handle file add/change events
 */
async function handleFileChange(filePath: string, event: 'add' | 'change'): Promise<void> {
  try {
    // Check if file was recently processed
    const stats = fs.statSync(filePath);
    const lastMod = state.lastModified.get(filePath);

    if (lastMod && stats.mtimeMs === lastMod) {
      return; // No actual change
    }

    state.lastModified.set(filePath, stats.mtimeMs);

    console.log(`[${event}] Processing: ${path.basename(filePath)}`);

    const parsed = await parseSessionFile(filePath);
    if (!parsed) {
      console.log(`  Skipped: Could not parse file`);
      return;
    }

    // Check if session already exists
    const existing = getSession(parsed.id);
    if (existing && event === 'add') {
      console.log(`  Skipped: Session already indexed`);
      return;
    }

    // Insert/update session
    const session = toSession(parsed);
    insertSession(session);

    // Insert file operations
    for (const file of parsed.filesModified) {
      insertSessionFile(file);
    }

    console.log(`  Indexed: ${parsed.messages.length} messages, ${parsed.filesModified.length} file ops`);
  } catch (error) {
    console.error(`  Error processing ${filePath}:`, error);
  }
}

/**
 * Scan all existing sessions (initial indexing)
 */
export async function scanAllSessions(claudePath?: string): Promise<number> {
  const projectsPath = claudePath || DEFAULT_CLAUDE_PATH;

  if (!fs.existsSync(projectsPath)) {
    console.log('Claude projects directory not found');
    return 0;
  }

  let count = 0;
  const projects = fs.readdirSync(projectsPath);

  for (const project of projects) {
    const projectDir = path.join(projectsPath, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const files = fs.readdirSync(projectDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = path.join(projectDir, file);
      await handleFileChange(filePath, 'add');
      count++;
    }
  }

  return count;
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): { running: boolean; path: string } {
  return {
    running: state.isRunning,
    path: DEFAULT_CLAUDE_PATH,
  };
}

export { DEFAULT_CLAUDE_PATH };
