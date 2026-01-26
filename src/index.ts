// AI Commit Context - Main exports

export * from './types.js';
export {
  initDatabase,
  insertSession,
  getSession,
  getAllSessions,
  updateSessionUploaded,
  insertSessionFile,
  getSessionFiles,
  getSessionsByFile,
  insertSessionCommit,
  getCommitSessions,
  getActiveSession,
  DB_PATH,
  ACC_DIR,
} from './db/index.js';
export * from './parser/index.js';
export * from './watcher/index.js';
export * from './hooks/index.js';
export {
  ensureAccDir,
  loadConfig,
  saveConfig,
  updateConfig,
  formatDate,
  formatRelativeTime,
  truncate,
  shortId,
  redactSecrets,
  isPathInside,
  getClaudeProjectsPath,
  CONFIG_PATH,
} from './utils/index.js';
export { uploadSession, linkCommitRemote } from './upload/index.js';
