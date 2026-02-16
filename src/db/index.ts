import path from 'path';
import os from 'os';
import fs from 'fs';
import type { Session, SessionFile, SessionCommit } from '../types.js';

const ACC_DIR = path.join(os.homedir(), '.acc');
const DB_PATH = path.join(ACC_DIR, 'database.json');

// Database structure
interface Database {
  sessions: Record<string, SessionRecord>;
  sessionFiles: SessionFileRecord[];
  sessionCommits: SessionCommitRecord[];
}

interface SessionRecord {
  id: string;
  projectPath: string;
  projectName: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  uploaded: boolean;
  uploadUrl: string | null;
}

interface SessionFileRecord {
  id: number;
  sessionId: string;
  filePath: string;
  operation: string;
  timestamp: string;
}

interface SessionCommitRecord {
  sessionId: string;
  commitSha: string;
  repoPath: string;
  createdAt: string;
}

// Ensure .acc directory exists
function ensureDir(): void {
  if (!fs.existsSync(ACC_DIR)) {
    fs.mkdirSync(ACC_DIR, { recursive: true });
  }
}

// Load database
function loadDb(): Database {
  ensureDir();

  if (!fs.existsSync(DB_PATH)) {
    const empty: Database = {
      sessions: {},
      sessionFiles: [],
      sessionCommits: [],
    };
    saveDb(empty);
    return empty;
  }

  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content) as Database;
  } catch {
    return {
      sessions: {},
      sessionFiles: [],
      sessionCommits: [],
    };
  }
}

// Save database
function saveDb(db: Database): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Initialize database
export function initDatabase(): void {
  loadDb(); // Creates file if doesn't exist
}

// Session operations
export function insertSession(session: Omit<Session, 'uploaded' | 'uploadUrl'>): void {
  const db = loadDb();

  db.sessions[session.id] = {
    id: session.id,
    projectPath: session.projectPath,
    projectName: session.projectName,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() || null,
    messageCount: session.messageCount,
    uploaded: false,
    uploadUrl: null,
  };

  saveDb(db);
}

export function getSession(id: string): Session | null {
  const db = loadDb();
  const record = db.sessions[id];

  if (!record) return null;

  return {
    id: record.id,
    projectPath: record.projectPath,
    projectName: record.projectName,
    startedAt: new Date(record.startedAt),
    endedAt: record.endedAt ? new Date(record.endedAt) : null,
    messageCount: record.messageCount,
    filesModified: getSessionFiles(record.id).map(f => f.filePath),
    uploaded: record.uploaded,
    uploadUrl: record.uploadUrl,
  };
}

export function getAllSessions(limit = 50): Session[] {
  const db = loadDb();

  const sessions = Object.values(db.sessions)
    .map(record => ({
      id: record.id,
      projectPath: record.projectPath,
      projectName: record.projectName,
      startedAt: new Date(record.startedAt),
      endedAt: record.endedAt ? new Date(record.endedAt) : null,
      messageCount: record.messageCount,
      filesModified: getSessionFiles(record.id).map(f => f.filePath),
      uploaded: record.uploaded,
      uploadUrl: record.uploadUrl,
    }))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit);

  return sessions;
}

export function updateSessionUploaded(id: string, uploadUrl: string): void {
  const db = loadDb();

  if (db.sessions[id]) {
    db.sessions[id].uploaded = true;
    db.sessions[id].uploadUrl = uploadUrl;
    saveDb(db);
  }
}

// Session files operations
let fileIdCounter = 0;

export function insertSessionFile(file: Omit<SessionFile, 'id'>): void {
  const db = loadDb();

  // Check for duplicates
  const exists = db.sessionFiles.some(
    f => f.sessionId === file.sessionId &&
         f.filePath === file.filePath &&
         f.timestamp === file.timestamp.toISOString()
  );

  if (exists) return;

  // Get next ID
  fileIdCounter = Math.max(fileIdCounter, ...db.sessionFiles.map(f => f.id), 0) + 1;

  db.sessionFiles.push({
    id: fileIdCounter,
    sessionId: file.sessionId,
    filePath: file.filePath,
    operation: file.operation,
    timestamp: file.timestamp.toISOString(),
  });

  saveDb(db);
}

export function getSessionFiles(sessionId: string): SessionFile[] {
  const db = loadDb();

  return db.sessionFiles
    .filter(f => f.sessionId === sessionId)
    .map(f => ({
      id: f.id,
      sessionId: f.sessionId,
      filePath: f.filePath,
      operation: f.operation as 'read' | 'write' | 'edit',
      timestamp: new Date(f.timestamp),
    }));
}

export function getSessionsByFile(filePath: string): Session[] {
  const db = loadDb();

  const sessionIds = new Set(
    db.sessionFiles
      .filter(f => f.filePath === filePath)
      .map(f => f.sessionId)
  );

  return Array.from(sessionIds)
    .map(id => getSession(id))
    .filter((s): s is Session => s !== null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

// Session commits operations
export function insertSessionCommit(commit: SessionCommit): void {
  const db = loadDb();

  // Check for duplicates
  const exists = db.sessionCommits.some(
    c => c.sessionId === commit.sessionId && c.commitSha === commit.commitSha
  );

  if (exists) return;

  db.sessionCommits.push({
    sessionId: commit.sessionId,
    commitSha: commit.commitSha,
    repoPath: commit.repoPath,
    createdAt: commit.createdAt.toISOString(),
  });

  saveDb(db);
}

export function getCommitSessions(commitSha: string): Session[] {
  const db = loadDb();

  const sessionIds = db.sessionCommits
    .filter(c => c.commitSha === commitSha || c.commitSha.startsWith(commitSha))
    .map(c => c.sessionId);

  return sessionIds
    .map(id => getSession(id))
    .filter((s): s is Session => s !== null);
}

export function getActiveSession(): Session | null {
  const db = loadDb();
  const cwd = process.cwd();

  // Consider a session "active" if:
  // 1. It was updated within the last 24 hours
  // 2. It matches the current working directory
  const ACTIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  const activeSessions = Object.values(db.sessions)
    .filter(s => {
      // Check if session was recently active
      const lastActivity = s.endedAt ? new Date(s.endedAt).getTime() : new Date(s.startedAt).getTime();
      const isRecent = (now - lastActivity) < ACTIVE_THRESHOLD_MS;

      // Check if session matches current directory
      const matchesCwd = cwd.startsWith(s.projectPath) || s.projectPath.startsWith(cwd);

      return isRecent && matchesCwd;
    })
    .sort((a, b) => {
      // Sort by most recent activity
      const aTime = a.endedAt ? new Date(a.endedAt).getTime() : new Date(a.startedAt).getTime();
      const bTime = b.endedAt ? new Date(b.endedAt).getTime() : new Date(b.startedAt).getTime();
      return bTime - aTime;
    });

  if (activeSessions.length === 0) return null;

  const record = activeSessions[0];
  return {
    id: record.id,
    projectPath: record.projectPath,
    projectName: record.projectName,
    startedAt: new Date(record.startedAt),
    endedAt: record.endedAt ? new Date(record.endedAt) : null,
    messageCount: record.messageCount,
    filesModified: getSessionFiles(record.id).map(f => f.filePath),
    uploaded: record.uploaded,
    uploadUrl: record.uploadUrl,
  };
}

// Initialize on import
initDatabase();

export { DB_PATH, ACC_DIR };
