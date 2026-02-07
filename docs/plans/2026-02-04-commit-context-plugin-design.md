# Commit Context Plugin Design

**Date:** 2026-02-04
**Status:** Approved
**Base URL:** https://ai-commit-context.vercel.app/

## Overview

Transform AI Commit Context from a standalone CLI tool into a **Claude Code plugin** that automatically links AI conversations to git commits and displays them on GitHub.

### User Journey

```
1. INSTALL
   claude plugins install github:yourusername/commit-context

2. AUTHENTICATE (one-time)
   Plugin prompts: "Login with GitHub to connect your repos"
   → Opens browser → GitHub OAuth → Success
   → API key auto-created, stored in ~/.acc/config.json

3. USE (automatic from here)
   - User works with Claude Code normally
   - Plugin watches session activity via hooks
   - On git commit → session uploaded → linked to commit
   - On git push → GitHub Action annotates PR

4. VIEW
   - PR shows: "🤖 AI Context: 'add auth feature'. 5 files. [View]"
   - Link opens webapp with clean conversation view
```

**No manual commands needed** after initial setup.

---

## Architecture

### Plugin Structure

```
commit-context/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── hooks/
│   └── hooks.json           # Hook configurations
├── scripts/
│   ├── on-commit.js         # Runs on git commit (upload + link)
│   ├── auth-flow.js         # GitHub OAuth handler
│   └── session-tracker.js   # Tracks active session/files
├── .mcp.json                 # Optional: MCP server for queries
└── README.md
```

### Hooks

| Hook | When | Action |
|------|------|--------|
| `SessionStart` | Claude Code starts | Initialize tracker, check auth |
| `PostToolUse` | After Write/Edit/Bash | Track modified files + repo |
| `Stop` | Session ends | Cleanup, finalize session data |

### Git Hook

| Hook | When | Action |
|------|------|--------|
| `prepare-commit-msg` | Before commit created | Upload session, add AI-Context trailers |

---

## Data Flow

### On Every Tool Use (PostToolUse hook)

```
Claude calls Write/Edit/Bash tool
         ↓
PostToolUse hook triggers session-tracker.js
         ↓
Extracts:
  - File path modified
  - Git repo (from git rev-parse --show-toplevel)
  - Git branch
  - Operation type (write/edit/bash)
         ↓
Stores in memory (session state file: ~/.acc/active-session.json)
```

### On Git Commit (prepare-commit-msg hook)

```
User runs: git commit -m "add feature"
         ↓
prepare-commit-msg hook calls on-commit.js
         ↓
1. Read active session state
2. Filter: only files in this repo that are staged
3. Build payload:
   {
     sessionId, projectName, messages,
     repos: [{ name, branch, files: [...] }],
     commitSha (empty until post-commit)
   }
4. Upload to API: POST /api/sessions
5. Receive: { shortCode, url }
6. Append trailers to commit message:
   AI-Context-ID: <sessionId>
   AI-Context-URL: https://ai-commit-context.vercel.app/s/<shortCode>
         ↓
Commit created with trailers
```

### On Push → GitHub Action

```
PR opened/updated
         ↓
GitHub Action reads commits for AI-Context-URL trailers
         ↓
Fetches conversation preview from API
         ↓
Posts PR comment + sets status check
```

---

## Repo Tracking

**Approach:** Track from git operations (not file paths - unreliable with worktrees)

**Multi-repo handling:** Show all repos touched by session

**Data captured:**
- Repo name and owner (from `git remote -v`)
- Branch name
- Files modified
- Commit SHAs linked

---

## Webapp Conversation Viewer

### Session Data Structure

```typescript
{
  sessionId: string
  projectName: string
  messages: ClaudeMessage[]
  repos: [{
    name: string           // "ai-commit-context"
    owner: string          // "yourusername"
    branch: string         // "main"
    filesModified: string[] // ["src/index.ts", "README.md"]
    commitSha?: string     // linked after commit
  }]
  startedAt: ISO string
  endedAt?: ISO string
}
```

### UI Design

**Default view (clean):**
- User prompts
- Assistant text responses
- Collapsed "Modified X files" summary (expandable)

**Detailed view toggle:**
- Tool calls with full outputs
- Thinking blocks
- Timestamps, metadata, UUIDs

```
┌─────────────────────────────────────────────────────┐
│ Session: wiggly-baking-pebble                       │
│ Repos: health-space (staging), ai-commit-context    │
│ 📅 Feb 4, 2026 • 23 messages                        │
│                                          [Detailed ☐]│
├─────────────────────────────────────────────────────┤
│                                                     │
│ 👤 User                                             │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Add authentication to the API                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 🤖 Assistant                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ I'll add JWT authentication to your API...      │ │
│ │                                                 │ │
│ │ 📁 Modified 5 files                        [▼]  │ │
│ │   └─ src/auth/jwt.ts (created)                  │ │
│ │   └─ src/middleware/auth.ts (edited)            │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## GitHub Action Integration

### PR Comment

```
┌─────────────────────────────────────────────────────┐
│ 🤖 AI Context                                       │
├─────────────────────────────────────────────────────┤
│ **Task:** "Add JWT authentication to the API"       │
│                                                     │
│ **Changes:** 5 files across 2 commits               │
│ • src/auth/jwt.ts (created)                         │
│ • src/middleware/auth.ts (edited)                   │
│ • src/routes/login.ts (created)                     │
│                                                     │
│ 🔗 [View full conversation](https://ai-commit-context.vercel.app/s/abc123)
└─────────────────────────────────────────────────────┘
```

### Commit Status Check

```
✓ commit-context — AI context linked
  Details → opens webapp viewer
```

### Workflow File

```yaml
# .github/workflows/commit-context.yml
name: Commit Context
on: [pull_request]

jobs:
  annotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: yourusername/commit-context-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Authentication Flow

### First-Time Setup

```
Terminal:
─────────────────────────────────────────
$ claude

🔗 Commit Context: Authentication required
   Opening browser for GitHub login...

   Or visit: https://ai-commit-context.vercel.app/auth/cli
   And enter code: ABCD-1234
```

```
Browser: ai-commit-context.vercel.app/auth/cli
─────────────────────────────────────────

   🔐 Connect Commit Context

   [  Login with GitHub  ]

   This will:
   • Link your Claude sessions to commits
   • Allow viewing conversations on PRs
```

### After OAuth

1. Webapp receives GitHub token
2. Creates/finds user in database
3. Generates API key for CLI
4. Returns to CLI via polling
5. CLI stores in `~/.acc/config.json`:
   ```json
   {
     "apiKey": "acc_xxxxxxxxxxxx",
     "userId": "github|12345",
     "username": "yourusername"
   }
   ```
6. Shows: "✓ Authenticated as @yourusername"

---

## Database Changes

### New/Modified Tables

```sql
-- Add to sessions table
ALTER TABLE sessions ADD COLUMN repos jsonb;
-- Format: [{ "name": "repo", "owner": "user", "branch": "main", "files": [...] }]

ALTER TABLE sessions ADD COLUMN first_user_message text;
-- For PR preview

-- Users table (new)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id text UNIQUE NOT NULL,
  github_username text NOT NULL,
  api_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Link sessions to users
ALTER TABLE sessions ADD COLUMN user_id uuid REFERENCES users(id);
```

### API Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/sessions` | Require `Authorization: Bearer acc_xxx` header |
| `GET /api/sessions/[code]` | Return cleaned messages + repos |
| `GET /api/sessions/[code]/preview` | New: return summary for GitHub Action |
| `POST /api/auth/github` | New: OAuth callback, creates user + API key |
| `GET /api/auth/poll/[code]` | New: CLI polls for auth completion |

---

## Implementation Phases

### Phase 1: Core Plugin (MVP)
- Plugin manifest + hooks structure
- Session tracker (PostToolUse hook)
- Git hook integration (prepare-commit-msg)
- Upload on commit with repo/file data
- Auth flow (GitHub OAuth → API key)

### Phase 2: Webapp Viewer
- Clean conversation view (prompts + responses + file summary)
- Detailed view toggle
- Repos display on session cards
- Preview endpoint for GitHub Action

### Phase 3: GitHub Action
- Action that reads commit trailers
- Posts PR comment with preview
- Sets commit status check

### Phase 4: Polish
- Error handling / offline resilience
- Session deduplication (same session, multiple commits)
- CLI commands: `acc status`, `acc logout`

---

## Future Improvements

| Improvement | Description |
|-------------|-------------|
| **GitHub App (Native Integration)** | Shows conversation in GitHub UI tab/panel instead of external webapp |
| **Team workspaces** | Shared sessions across team members |
| **Search** | Full-text search across conversations |
| **Analytics** | AI usage stats per repo/user |
| **VS Code extension** | View context directly in editor |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plugin architecture | Hook-based | Auto-runs without user commands |
| Upload trigger | On every commit | Immediate linking, most accurate |
| Repo tracking | From git operations | Reliable with worktrees |
| Auth method | GitHub OAuth + auto-provision | Best UX - one login |
| Viewer default | Clean with file summary | Readable, not overwhelming |
| GitHub display | PR comment + status check | Maximum visibility |
| Plugin distribution | Own repo first → official later | Validate before publishing |
