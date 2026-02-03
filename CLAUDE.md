# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Commit Context (ACC) connects Claude Code conversations to GitHub commits. It consists of:
- **CLI** (`src/`): Node.js CLI tool published to npm as `ai-commit-context`
- **Webapp** (`webapp/`): Next.js app deployed on Vercel with Supabase backend
- **GitHub Action** (`github-action/`): Annotates PRs with conversation links

## Build Commands

```bash
# CLI - Build TypeScript
npm run build        # or: npx tsc

# Webapp - Development
cd webapp && npm run dev

# Webapp - Deploy
cd webapp && vercel --prod
```

## Architecture

### CLI Data Flow
1. Claude Code stores sessions in `~/.claude/projects/<project>/*.jsonl`
2. `acc scan` parses JSONL files and indexes in local JSON DB (`~/.acc/db.json`)
3. `acc upload` sends session data to webapp API via HTTPS POST
4. Git hooks (prepare-commit-msg) add `AI-Context-ID` trailer to commits

### Key Files
- `src/cli/index.ts` - All CLI commands (commander.js)
- `src/upload/index.ts` - Upload logic using native `https` module (not fetch)
- `src/parser/index.ts` - JSONL session file parser
- `src/db/index.ts` - Local JSON database operations
- `src/hooks/index.ts` - Git hook installation and commit linking

### Webapp API Routes
- `POST /api/sessions` - Upload session (stores in Supabase)
- `GET /api/sessions` - List sessions
- `GET /api/sessions/[code]` - Get session by short code
- `POST /api/sessions/[code]/commits` - Link commit to session
- `GET /api/commits/[sha]/context` - Get AI context for commit

### Database Schema (Supabase)
- `sessions` - Uploaded conversation sessions
- `messages` - Individual messages within sessions
- `session_commits` - Links between sessions and git commits

## NPM Publishing

```bash
# Bump version in package.json and src/cli/index.ts
npm run build
npm publish
```

The `files` field in package.json only includes `dist/` folder.

## Environment Variables

Webapp requires in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Known Issues

- Upload uses native `https` module instead of `fetch` due to ES module compatibility issues on Windows
- Session parsing skips files that don't match expected JSONL format
