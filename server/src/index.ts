import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3456;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✓ Connected to Supabase');
} else {
  console.log('⚠ Supabase not configured - running in local mode');
}

// Fallback local storage (when Supabase is not configured)
import fs from 'fs';
const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface LocalSession {
  id: string;
  shortCode: string;
  projectName: string;
  uploadedAt: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  messages: unknown[];
  filesModified: string[];
  commits: { sha: string; repoUrl: string; message: string; linkedAt: string }[];
}

interface LocalStore {
  sessions: Record<string, LocalSession>;
}

function loadLocalSessions(): LocalStore {
  if (!fs.existsSync(SESSIONS_FILE)) return { sessions: {} };
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return { sessions: {} };
  }
}

function saveLocalSessions(store: LocalStore): void {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(store, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', '..', 'web')));

// =============================================================================
// API Routes
// =============================================================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    database: supabase ? 'supabase' : 'local'
  });
});

// Upload session
app.post('/api/sessions', async (req, res) => {
  try {
    const { sessionId, projectName, startedAt, endedAt, messages, filesModified } = req.body;

    if (!sessionId || !messages) {
      res.status(400).json({ error: 'Missing required fields: sessionId, messages' });
      return;
    }

    const shortCode = nanoid(8);
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    if (supabase) {
      // Use Supabase
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          short_code: shortCode,
          project_name: projectName || 'Unknown Project',
          started_at: startedAt || new Date().toISOString(),
          ended_at: endedAt || null,
          message_count: messages.length,
          messages: messages,
          files_modified: filesModified || [],
          privacy: 'unlisted'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        res.status(500).json({ error: 'Failed to upload session' });
        return;
      }

      res.json({
        success: true,
        id: data.id,
        shortCode: data.short_code,
        url: `${baseUrl}/c/${data.short_code}`,
      });
    } else {
      // Use local storage
      const store = loadLocalSessions();
      store.sessions[sessionId] = {
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
      saveLocalSessions(store);

      res.json({
        success: true,
        id: sessionId,
        shortCode,
        url: `${baseUrl}/c/${shortCode}`,
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload session' });
  }
});

// Get session by short code
app.get('/api/sessions/:code', async (req, res) => {
  const { code } = req.params;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('short_code', code)
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Get linked commits
      const { data: commitLinks } = await supabase
        .from('session_commits')
        .select('commits(*)')
        .eq('session_id', data.id);

      const commits = commitLinks?.map((link: { commits: unknown }) => link.commits) || [];

      res.json({
        id: data.id,
        shortCode: data.short_code,
        projectName: data.project_name,
        uploadedAt: data.created_at,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        messageCount: data.message_count,
        messages: data.messages,
        filesModified: data.files_modified,
        commits
      });
    } else {
      const store = loadLocalSessions();
      const session = Object.values(store.sessions).find(
        s => s.shortCode === code || s.id === code || s.id.startsWith(code)
      );

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(session);
    }
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Link commit to session
app.post('/api/sessions/:code/commits', async (req, res) => {
  const { code } = req.params;
  const { sha, repoUrl, message } = req.body;

  if (!sha) {
    res.status(400).json({ error: 'Missing required field: sha' });
    return;
  }

  try {
    if (supabase) {
      // Get session
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('short_code', code)
        .single();

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      // Insert or get commit
      const { data: commit } = await supabase
        .from('commits')
        .upsert({
          sha,
          repo_url: repoUrl || '',
          message: message || ''
        }, { onConflict: 'sha,repo_url' })
        .select()
        .single();

      if (commit) {
        // Link session to commit
        await supabase
          .from('session_commits')
          .upsert({
            session_id: session.id,
            commit_id: commit.id
          });
      }

      res.json({ success: true });
    } else {
      const store = loadLocalSessions();
      const session = Object.values(store.sessions).find(
        s => s.shortCode === code || s.id === code
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

      saveLocalSessions(store);
      res.json({ success: true, commits: session.commits });
    }
  } catch (error) {
    console.error('Error linking commit:', error);
    res.status(500).json({ error: 'Failed to link commit' });
  }
});

// Get context for a commit
app.get('/api/commits/:sha/context', async (req, res) => {
  const { sha } = req.params;

  try {
    if (supabase) {
      const { data: commits } = await supabase
        .from('commits')
        .select('id')
        .or(`sha.eq.${sha},sha.like.${sha}%`);

      if (!commits || commits.length === 0) {
        res.json({ commitSha: sha, sessions: [] });
        return;
      }

      const commitIds = commits.map(c => c.id);

      const { data: links } = await supabase
        .from('session_commits')
        .select('sessions(*)')
        .in('commit_id', commitIds);

      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessions = links?.map((link: any) => ({
        id: link.sessions.id,
        shortCode: link.sessions.short_code,
        url: `${baseUrl}/c/${link.sessions.short_code}`,
        projectName: link.sessions.project_name,
        messageCount: link.sessions.message_count,
        startedAt: link.sessions.started_at,
      })) || [];

      res.json({ commitSha: sha, sessions });
    } else {
      const store = loadLocalSessions();
      const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

      const sessions = Object.values(store.sessions)
        .filter(s => s.commits.some(c => c.sha === sha || c.sha.startsWith(sha)))
        .map(s => ({
          id: s.id,
          shortCode: s.shortCode,
          url: `${baseUrl}/c/${s.shortCode}`,
          projectName: s.projectName,
          messageCount: s.messageCount,
          startedAt: s.startedAt,
        }));

      res.json({ commitSha: sha, sessions });
    }
  } catch (error) {
    console.error('Error fetching commit context:', error);
    res.status(500).json({ error: 'Failed to fetch commit context' });
  }
});

// List all sessions
app.get('/api/sessions', async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('session_summaries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Fallback to sessions table if view doesn't exist
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, short_code, project_name, message_count, created_at, started_at')
          .order('created_at', { ascending: false })
          .limit(50);

        res.json({
          sessions: sessions?.map(s => ({
            id: s.id,
            shortCode: s.short_code,
            projectName: s.project_name,
            messageCount: s.message_count,
            uploadedAt: s.created_at,
            startedAt: s.started_at,
          })) || []
        });
        return;
      }

      res.json({
        sessions: data?.map(s => ({
          id: s.id,
          shortCode: s.short_code,
          projectName: s.project_name,
          messageCount: s.message_count,
          uploadedAt: s.created_at,
          startedAt: s.started_at,
          commitCount: s.commit_count
        })) || []
      });
    } else {
      const store = loadLocalSessions();
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
    }
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Serve web viewer
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
║   Database: ${supabase ? 'Supabase' : 'Local JSON'}                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
