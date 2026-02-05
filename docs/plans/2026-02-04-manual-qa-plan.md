# Commit Context Plugin - Manual QA Plan

> **For Claude:** This is a manual testing checklist for the user. No automated execution needed.

**Goal:** Verify the commit-context plugin works end-to-end in both localhost and production environments.

**Components to Test:**
- Plugin authentication flow
- Session tracking during Claude Code usage
- Commit hook integration
- Webapp session viewer
- GitHub Action PR annotations

---

## Prerequisites

### Environment Setup

Before testing, ensure you have:

1. **Local environment variables** in `webapp/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   GITHUB_CLIENT_ID=<your-github-oauth-app-id>
   GITHUB_CLIENT_SECRET=<your-github-oauth-app-secret>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **Database migration applied**:
   ```bash
   cd webapp
   npx supabase db push
   # Or manually run: webapp/supabase/migrations/20260204000001_auth_and_repos.sql
   ```

3. **GitHub OAuth App configured**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create new app with callback URL: `http://localhost:3000/api/auth/github` (for local)
   - Note the Client ID and Client Secret

---

## Part 1: Localhost Testing

### Task 1: Start Local Webapp

**Steps:**
1. Open terminal in `webapp/` directory
2. Run `npm run dev`
3. Verify server starts on http://localhost:3000

**Expected:** Dev server running, homepage accessible

---

### Task 2: Test Device Authentication Flow

**Steps:**
1. Open new terminal
2. Navigate to `plugin/scripts/`
3. Run: `node auth-flow.js login`
4. Observe terminal output - should show device code and URL
5. Browser should open automatically to `http://localhost:3000/auth/cli?code=XXXXXXXX`
6. Verify device code displayed in browser matches terminal
7. Click "Continue with GitHub"
8. Complete GitHub OAuth flow
9. Return to terminal - should show "Authentication successful!"
10. Verify config saved: `cat ~/.acc/config.json`

**Expected:**
- Device code displayed in both terminal and browser
- GitHub OAuth redirects correctly
- Terminal receives API key after ~2-3 seconds
- Config file contains `apiKey`, `userId`, `username`

---

### Task 3: Verify Auth Status

**Steps:**
1. Run: `node auth-flow.js status`

**Expected:**
```
Commit Context Authentication Status

Config file: ~/.acc/config.json
API URL: https://ai-commit-context.vercel.app
Status: Authenticated
User: <your-github-username>
API Key: acc_xxxx...
```

---

### Task 4: Test Session Tracking

**Steps:**
1. Start a new Claude Code session in any git repository
2. Make some file modifications using Claude Code
3. Check session state: `node plugin/scripts/session-tracker.js get`

**Expected:**
- Session file exists at `~/.acc/active-session.json`
- Contains `sessionId`, `repos` array with tracked files

---

### Task 5: Test Commit Integration

**Steps:**
1. Stage your changes: `git add -A`
2. Commit with a message: `git commit -m "Test commit"`
3. Check commit message: `git log -1 --format=full`

**Expected:**
- Commit message includes trailers:
  ```
  AI-Context-ID: session_xxxxx
  AI-Context-URL: http://localhost:3000/s/XXXXXX
  ```
- Terminal shows: `✓ AI context linked: http://localhost:3000/s/XXXXXX`

---

### Task 6: Test Session Viewer

**Steps:**
1. Open the AI-Context-URL from the commit in browser
2. Review the session viewer page

**Expected:**
- Page loads without errors
- Shows conversation messages with user/assistant bubbles
- Files modified shown in collapsible sections
- Toggle between "Clean" and "Detailed" view works
- Repository badges link correctly (if GitHub repo)

---

### Task 7: Test Preview API (for GitHub Action)

**Steps:**
1. Get the short code from your session URL (e.g., `XXXXXX` from `/s/XXXXXX`)
2. Run: `curl http://localhost:3000/api/sessions/XXXXXX/preview`

**Expected:**
```json
{
  "shortCode": "XXXXXX",
  "firstUserMessage": "...",
  "fileCount": N,
  "repoCount": N,
  "url": "http://localhost:3000/s/XXXXXX"
}
```

---

### Task 8: Test Logout

**Steps:**
1. Run: `node auth-flow.js logout`
2. Verify: `node auth-flow.js status`

**Expected:**
- "Logged out successfully"
- Status shows "Not authenticated"

---

## Part 2: Remote/Production Testing

### Prerequisites for Production

1. **Deploy webapp to Vercel** (or your hosting):
   ```bash
   cd webapp
   vercel --prod
   ```

2. **Update environment variables in Vercel**:
   - Same as local, but `NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app`
   - GitHub OAuth callback URL updated to production domain

3. **Run database migration on production Supabase**

---

### Task 9: Test Remote Authentication

**Steps:**
1. Update API URL (optional - defaults to production):
   ```bash
   echo '{"apiUrl":"https://ai-commit-context.vercel.app"}' > ~/.acc/config.json
   ```
2. Run: `node auth-flow.js login`
3. Complete OAuth flow in browser
4. Verify authentication works

**Expected:** Same as local Task 2, but using production URLs

---

### Task 10: Test Remote Upload

**Steps:**
1. Ensure authenticated with production
2. Make changes and commit in a test repo
3. Verify session uploaded to production

**Expected:**
- Commit trailers point to production URL
- Session viewable at production URL

---

### Task 11: Test GitHub Action (requires PR)

**Steps:**
1. Create a branch with commits containing AI-Context-ID trailers
2. Push branch and create PR
3. Add GitHub Action workflow to repo:
   ```yaml
   # .github/workflows/ai-context.yml
   name: AI Context
   on:
     pull_request:
       types: [opened, synchronize]

   jobs:
     annotate:
       runs-on: ubuntu-latest
       steps:
         - uses: ai-commit-context/action@main
           with:
             github-token: ${{ secrets.GITHUB_TOKEN }}
   ```
4. Observe PR annotations

**Expected:**
- PR comment added with AI context summary
- Commit status shows "AI context linked" with link
- Clicking link opens session viewer

---

## Part 3: Error Handling Tests

### Task 12: Test Offline Behavior

**Steps:**
1. Disconnect from internet (or block API URL)
2. Make changes and commit
3. Check `~/.acc/pending/` directory

**Expected:**
- Commit succeeds (not blocked)
- Warning shown: "⚠ Offline: Cannot connect to server..."
- Session saved to `~/.acc/pending/session_xxx.json`

---

### Task 13: Test Pending Session Sync

**Steps:**
1. Reconnect to internet
2. Run: `node auth-flow.js sync`

**Expected:**
- Pending sessions uploaded
- Files removed from `~/.acc/pending/`

---

### Task 14: Test Expired Device Code

**Steps:**
1. Run: `node auth-flow.js login`
2. Wait 10+ minutes WITHOUT completing OAuth
3. Try to complete OAuth flow

**Expected:**
- Error message: "This authentication code has expired"
- Prompts to run login command again

---

### Task 15: Test Invalid API Key

**Steps:**
1. Manually edit `~/.acc/config.json` to have invalid apiKey
2. Try to commit

**Expected:**
- Warning: "⚠ API key expired or invalid. Run: acc auth login"
- Commit still succeeds (not blocked)

---

## Summary Checklist

### Localhost
- [ ] Webapp starts on localhost:3000
- [ ] Device code auth flow works
- [ ] Auth status command works
- [ ] Session tracking captures files
- [ ] Commit adds AI-Context trailers
- [ ] Session viewer displays correctly
- [ ] Preview API returns correct data
- [ ] Logout clears credentials

### Production
- [ ] Webapp deployed and accessible
- [ ] Remote auth flow works
- [ ] Sessions upload to production
- [ ] GitHub Action adds PR comments
- [ ] Commit status links work

### Error Handling
- [ ] Offline commits save to pending
- [ ] Sync uploads pending sessions
- [ ] Expired codes show error
- [ ] Invalid API keys handled gracefully

---

## Troubleshooting

**"Cannot connect to server" errors:**
- Check `~/.acc/config.json` has correct `apiUrl`
- Verify webapp is running (local) or deployed (prod)

**OAuth callback fails:**
- Verify GitHub OAuth app callback URL matches environment
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set

**No trailers added to commit:**
- Check `~/.acc/config.json` has valid `apiKey`
- Verify `~/.acc/active-session.json` exists with tracked files
- Ensure staged files match tracked files

**Session viewer shows raw JSON:**
- Check `cleanMessages` function is working
- Verify message format matches expected JSONL structure
