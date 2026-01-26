import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3456;

// Data storage
const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Types
interface Message {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  type: 'user' | 'assistant';
  message: {
    role: string;
    content: string | ContentBlock[];
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

interface StoredSession {
  id: string;
  shortCode: string;
  projectName: string;
  uploadedAt: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  messages: Message[];
  filesModified: string[];
  commits: CommitLink[];
}

interface CommitLink {
  sha: string;
  repoUrl: string;
  message: string;
  linkedAt: string;
}

interface SessionsStore {
  sessions: Record<string, StoredSession>;
}

// Load/save sessions
function loadSessions(): SessionsStore {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return { sessions: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return { sessions: {} };
  }
}

function saveSessions(store: SessionsStore): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static web files
app.use(express.static(path.join(__dirname, '..', '..', 'web')));

// =============================================================================
// API Routes
// =============================================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// Upload session
app.post('/api/sessions', (req, res) => {
  try {
    const { sessionId, projectName, startedAt, endedAt, messages, filesModified } = req.body;

    if (!sessionId || !messages) {
      res.status(400).json({ error: 'Missing required fields: sessionId, messages' });
      return;
    }

    const store = loadSessions();
    const shortCode = nanoid(8);

    const session: StoredSession = {
      id: sessionId,
      shortCode,
      projectName: projectName || 'Unknown Project',
      uploadedAt: new Date().toISOString(),
      startedAt: startedAt || new Date().toISOString(),
      endedAt: endedAt || null,
      messageCount: messages.length,
      messages,
      filesModified: filesModified || [],
      commits: [],
    };

    store.sessions[sessionId] = session;
    saveSessions(store);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    res.json({
      success: true,
      id: sessionId,
      shortCode,
      url: `${baseUrl}/c/${shortCode}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload session' });
  }
});

// Get session by short code
app.get('/api/sessions/:code', (req, res) => {
  const { code } = req.params;
  const store = loadSessions();

  // Find by short code or full ID
  const session = Object.values(store.sessions).find(
    s => s.shortCode === code || s.id === code || s.id.startsWith(code)
  );

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json(session);
});

// Link commit to session
app.post('/api/sessions/:code/commits', (req, res) => {
  const { code } = req.params;
  const { sha, repoUrl, message } = req.body;

  if (!sha) {
    res.status(400).json({ error: 'Missing required field: sha' });
    return;
  }

  const store = loadSessions();
  const session = Object.values(store.sessions).find(
    s => s.shortCode === code || s.id === code || s.id.startsWith(code)
  );

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  session.commits.push({
    sha,
    repoUrl: repoUrl || '',
    message: message || '',
    linkedAt: new Date().toISOString(),
  });

  saveSessions(store);

  res.json({ success: true, commits: session.commits });
});

// Get context for a commit
app.get('/api/commits/:sha/context', (req, res) => {
  const { sha } = req.params;
  const store = loadSessions();

  const sessions = Object.values(store.sessions).filter(
    s => s.commits.some(c => c.sha === sha || c.sha.startsWith(sha))
  );

  res.json({
    commitSha: sha,
    sessions: sessions.map(s => ({
      id: s.id,
      shortCode: s.shortCode,
      url: `${process.env.BASE_URL || `http://localhost:${PORT}`}/c/${s.shortCode}`,
      projectName: s.projectName,
      messageCount: s.messageCount,
      startedAt: s.startedAt,
    })),
  });
});

// List all sessions
app.get('/api/sessions', (_req, res) => {
  const store = loadSessions();

  const sessions = Object.values(store.sessions)
    .map(s => ({
      id: s.id,
      shortCode: s.shortCode,
      projectName: s.projectName,
      messageCount: s.messageCount,
      uploadedAt: s.uploadedAt,
      startedAt: s.startedAt,
      commitsCount: s.commits.length,
    }))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  res.json({ sessions });
});

// Serve web viewer for any /c/:code route
app.get('/c/:code', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'web', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   AI Commit Context Server                                ║
║                                                           ║
║   Local:    http://localhost:${PORT}                        ║
║   API:      http://localhost:${PORT}/api                    ║
║   Viewer:   http://localhost:${PORT}/c/{code}               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
