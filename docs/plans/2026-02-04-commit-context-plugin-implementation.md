# Commit Context Plugin Implementation Plan

**Date:** 2026-02-04
**Design:** [2026-02-04-commit-context-plugin-design.md](./2026-02-04-commit-context-plugin-design.md)
**Status:** Ready for Implementation

---

## Overview

This plan implements the commit-context plugin in 4 phases, transforming the CLI tool into an automatic Claude Code plugin.

---

## Phase 1: Core Plugin Infrastructure

### 1.1 Create Plugin Directory Structure
**Files to create:**
```
plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── scripts/
│   ├── session-tracker.js
│   ├── on-commit.js
│   └── auth-flow.js
├── package.json
└── README.md
```

**Tasks:**
- [ ] Create `plugin/.claude-plugin/plugin.json` with manifest:
  - name: "commit-context"
  - version: "1.0.0"
  - description, author, repository
- [ ] Create `plugin/package.json` for plugin dependencies
- [ ] Create basic `plugin/README.md` with installation instructions

### 1.2 Implement Session Tracker
**File:** `plugin/scripts/session-tracker.js`

**Tasks:**
- [ ] Create state file manager for `~/.acc/active-session.json`
- [ ] Implement `initSession()` - called on SessionStart
- [ ] Implement `trackFileModification(toolResult)`:
  - Extract file path from tool result
  - Run `git rev-parse --show-toplevel` to get repo root
  - Run `git rev-parse --abbrev-ref HEAD` to get branch
  - Parse `git remote -v` to get owner/name
  - Store in session state: `{ repos: [{ name, owner, branch, files }] }`
- [ ] Implement `getActiveSession()` - returns current state
- [ ] Implement `clearSession()` - called on Stop

### 1.3 Configure Plugin Hooks
**File:** `plugin/hooks/hooks.json`

**Tasks:**
- [ ] Add `SessionStart` hook:
  ```json
  {
    "event": "SessionStart",
    "script": "scripts/session-tracker.js",
    "args": ["init"]
  }
  ```
- [ ] Add `PostToolUse` hook with matcher for Write/Edit/Bash:
  ```json
  {
    "event": "PostToolUse",
    "matcher": { "tool_name": ["Write", "Edit", "Bash"] },
    "script": "scripts/session-tracker.js",
    "args": ["track"]
  }
  ```
- [ ] Add `Stop` hook:
  ```json
  {
    "event": "Stop",
    "script": "scripts/session-tracker.js",
    "args": ["cleanup"]
  }
  ```

### 1.4 Implement Git Hook Integration
**File:** `plugin/scripts/on-commit.js`

**Tasks:**
- [ ] Read staged files with `git diff --cached --name-only`
- [ ] Load active session from `~/.acc/active-session.json`
- [ ] Filter session files to only staged files in current repo
- [ ] Parse Claude session JSONL for messages (reuse `src/parser/index.ts` logic)
- [ ] Build upload payload:
  ```typescript
  {
    sessionId, projectName, messages,
    repos: [{ name, owner, branch, files, commitSha: null }],
    startedAt, endedAt
  }
  ```
- [ ] Upload to API with Bearer token
- [ ] On success: append trailers to commit message file
  - `AI-Context-ID: <sessionId>`
  - `AI-Context-URL: <viewerUrl>`
- [ ] Handle offline/error gracefully (don't block commit)

### 1.5 Git Hook Installation
**Tasks:**
- [ ] Create installer script that:
  - Finds git root
  - Creates/updates `.git/hooks/prepare-commit-msg`
  - Makes hook executable
  - Backs up existing hook if present
- [ ] Integrate with SessionStart hook to auto-install if not present

---

## Phase 2: Authentication System

### 2.1 Webapp Auth Endpoints
**Files to modify/create:**
- `webapp/app/api/auth/github/route.ts` - OAuth callback
- `webapp/app/api/auth/poll/[code]/route.ts` - CLI polling
- `webapp/app/api/auth/device/route.ts` - Generate device code

**Tasks:**
- [ ] Create `POST /api/auth/device`:
  - Generate random 8-char device code
  - Store in Supabase with expiry (10 min)
  - Return `{ deviceCode, verificationUrl }`
- [ ] Create `GET /api/auth/github`:
  - OAuth callback from GitHub
  - Exchange code for access token
  - Get user info from GitHub API
  - Create/update user in `users` table
  - Generate API key `acc_<random>`
  - Link to device code if present
- [ ] Create `GET /api/auth/poll/[code]`:
  - Check if device code has been claimed
  - If claimed: return `{ apiKey, userId, username }`
  - If pending: return `{ status: "pending" }`
  - If expired: return `{ error: "expired" }`

### 2.2 Database Schema Updates
**File:** `webapp/supabase/migrations/20260204_auth_updates.sql`

**Tasks:**
- [ ] Create migration for `users` table:
  ```sql
  CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id text UNIQUE NOT NULL,
    github_username text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ```
- [ ] Create `device_codes` table:
  ```sql
  CREATE TABLE device_codes (
    code text PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    api_key text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ```
- [ ] Update `api_keys` table to link to users:
  ```sql
  ALTER TABLE api_keys ADD COLUMN user_id uuid REFERENCES users(id);
  ```
- [ ] Update `sessions` table:
  ```sql
  ALTER TABLE sessions ADD COLUMN user_id uuid REFERENCES users(id);
  ALTER TABLE sessions ADD COLUMN repos jsonb;
  ALTER TABLE sessions ADD COLUMN first_user_message text;
  ```

### 2.3 Plugin Auth Flow
**File:** `plugin/scripts/auth-flow.js`

**Tasks:**
- [ ] Implement `checkAuth()`:
  - Read `~/.acc/config.json`
  - If `apiKey` exists, return true
  - If not, trigger auth flow
- [ ] Implement `startAuthFlow()`:
  - Call `POST /api/auth/device` to get code
  - Print device code and URL to terminal
  - Open browser to verification URL
  - Poll `/api/auth/poll/[code]` every 2 seconds
  - On success: save to `~/.acc/config.json`
  - Print success message

### 2.4 Auth UI Page
**File:** `webapp/app/auth/cli/page.tsx`

**Tasks:**
- [ ] Create page with GitHub OAuth button
- [ ] Show device code input field (optional - can auto-detect from URL)
- [ ] After OAuth success, show confirmation
- [ ] Handle error states (expired code, already used)

---

## Phase 3: Webapp Conversation Viewer

### 3.1 Enhanced Session Data Model
**File:** `webapp/lib/types.ts`

**Tasks:**
- [ ] Define `CleanMessage` type (subset for display):
  ```typescript
  type CleanMessage = {
    role: 'user' | 'assistant'
    content: string
    filesModified?: string[]
    timestamp?: string
  }
  ```
- [ ] Define `RepoInfo` type:
  ```typescript
  type RepoInfo = {
    name: string
    owner: string
    branch: string
    filesModified: string[]
    commitSha?: string
  }
  ```
- [ ] Update `Session` type with `repos` and `firstUserMessage`

### 3.2 Session Parser for Clean View
**File:** `webapp/lib/session-cleaner.ts`

**Tasks:**
- [ ] Create `cleanMessages(rawMessages)`:
  - Extract only user prompts and assistant text responses
  - Detect file modifications from tool_use blocks
  - Attach files to the message that modified them
  - Strip internal metadata, thinking blocks, system messages
- [ ] Create `extractFirstUserMessage(messages)`:
  - Find first human message
  - Truncate to ~100 chars for preview

### 3.3 Session Viewer Page Redesign
**File:** `webapp/app/s/[code]/page.tsx`

**Tasks:**
- [ ] Add state for `detailedView` toggle (default false)
- [ ] Create `ConversationView` component:
  - Shows clean messages when `detailedView` is false
  - Shows full raw data when `detailedView` is true
- [ ] Create `MessageBubble` component:
  - User messages: right-aligned, blue
  - Assistant messages: left-aligned, gray
  - Collapsible "Modified X files" section
- [ ] Create `SessionHeader` component:
  - Session name/ID
  - Repo badges (clickable to GitHub)
  - Date, message count
  - Detailed view toggle
- [ ] Create `FilesSummary` component:
  - Collapsed by default
  - Shows file paths with icons (created/edited)

### 3.4 API Endpoint Updates
**File:** `webapp/app/api/sessions/[code]/route.ts`

**Tasks:**
- [ ] Return `cleanMessages` in response (computed on fetch)
- [ ] Include `repos` array in response
- [ ] Add `firstUserMessage` for preview

### 3.5 Preview Endpoint for GitHub Action
**File:** `webapp/app/api/sessions/[code]/preview/route.ts`

**Tasks:**
- [ ] Create `GET /api/sessions/[code]/preview`:
  - Return: `{ shortCode, firstUserMessage, fileCount, repoCount, url }`
  - Used by GitHub Action for PR comment

---

## Phase 4: GitHub Action

### 4.1 Update GitHub Action
**File:** `github-action/src/index.ts`

**Tasks:**
- [ ] Update to use new `/preview` endpoint
- [ ] Generate improved PR comment format:
  ```markdown
  ## 🤖 AI Context

  **Task:** "{firstUserMessage}"

  **Changes:** {fileCount} files across {commitCount} commits

  [View full conversation]({url})
  ```
- [ ] Add commit status check:
  - State: success
  - Context: "commit-context"
  - Target URL: viewer URL
  - Description: "AI context linked"

### 4.2 Action Configuration
**File:** `github-action/action.yml`

**Tasks:**
- [ ] Update inputs to include `set-status` option (default: true)
- [ ] Update outputs to include `session-url`

### 4.3 Documentation
**File:** `github-action/README.md`

**Tasks:**
- [ ] Update usage examples
- [ ] Document new comment format
- [ ] Add status check documentation

---

## Phase 5: Polish & Testing

### 5.1 Error Handling
**Tasks:**
- [ ] Handle offline scenarios in `on-commit.js`:
  - Queue uploads for later
  - Don't block commits
- [ ] Handle auth expiry in session tracker
- [ ] Add retry logic for API calls

### 5.2 CLI Commands (Optional)
**Tasks:**
- [ ] Add `acc status` command to check plugin health
- [ ] Add `acc logout` command to clear credentials
- [ ] Add `acc link` manual linking for edge cases

### 5.3 Testing
**Tasks:**
- [ ] Test plugin installation flow
- [ ] Test auth flow end-to-end
- [ ] Test file tracking across multiple repos
- [ ] Test commit linking
- [ ] Test GitHub Action PR comments
- [ ] Test offline resilience

### 5.4 Distribution
**Tasks:**
- [ ] Publish to GitHub repo
- [ ] Add installation instructions
- [ ] Test `claude plugins install github:username/commit-context`
- [ ] Submit to official marketplace (after validation)

---

## File Summary

### New Files
| Path | Purpose |
|------|---------|
| `plugin/.claude-plugin/plugin.json` | Plugin manifest |
| `plugin/hooks/hooks.json` | Hook configurations |
| `plugin/scripts/session-tracker.js` | Tracks files per session |
| `plugin/scripts/on-commit.js` | Upload + link on commit |
| `plugin/scripts/auth-flow.js` | GitHub OAuth flow |
| `plugin/package.json` | Plugin dependencies |
| `webapp/app/api/auth/device/route.ts` | Device code generation |
| `webapp/app/api/auth/github/route.ts` | OAuth callback |
| `webapp/app/api/auth/poll/[code]/route.ts` | Auth polling |
| `webapp/app/api/sessions/[code]/preview/route.ts` | PR preview data |
| `webapp/app/auth/cli/page.tsx` | CLI auth page |
| `webapp/lib/session-cleaner.ts` | Message cleaning |
| `webapp/lib/types.ts` | Shared types |

### Modified Files
| Path | Changes |
|------|---------|
| `webapp/app/s/[code]/page.tsx` | New conversation viewer UI |
| `webapp/app/api/sessions/[code]/route.ts` | Return clean messages + repos |
| `webapp/app/api/sessions/route.ts` | Accept repos, require auth |
| `github-action/src/index.ts` | New comment format, status checks |
| `github-action/action.yml` | New inputs/outputs |

---

## Dependencies

### Plugin
- Node.js (for scripts)
- No external npm packages needed (uses shell commands)

### Webapp
- Existing: Next.js, Supabase, @supabase/supabase-js
- No new dependencies needed

---

## Implementation Order

**Recommended sequence:**
1. Phase 1.1-1.3 (Plugin structure + session tracker)
2. Phase 2.2 (Database schema)
3. Phase 2.1 + 2.3 + 2.4 (Auth endpoints + flow)
4. Phase 1.4-1.5 (Git hook integration)
5. Phase 3.1-3.4 (Webapp viewer)
6. Phase 3.5 + 4.x (GitHub Action)
7. Phase 5.x (Polish)

This order ensures each phase builds on working infrastructure.
