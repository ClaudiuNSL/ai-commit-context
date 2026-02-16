# AI Commit Context (acc)

Connect Claude Code conversations to GitHub commits and pull requests.

## The Problem

When you work with Claude Code, your conversations are stored locally and disconnected from your Git history. Code reviewers see *what* changed but not *why* or what AI assistance was involved.

## The Solution

ACC automatically links your Claude Code conversations to your commits, so anyone reviewing your PR can see the full context of how the code was developed.

## Components

| Component | Description |
|-----------|-------------|
| **CLI Tool** | Track sessions, link commits, upload conversations |
| **Server API** | Store and serve conversation data |
| **Web Viewer** | Beautiful UI to view conversations |
| **GitHub Action** | Automatically annotate PRs |

## Installation

```bash
npm install -g @ai-commit-context/cli
```

## Quick Start

```bash
# Initialize in your repository
cd your-project
acc init

# Work with Claude Code as usual...
# Your conversations are automatically tracked

# Check indexed sessions
acc sessions list

# Upload a session
acc upload

# View session details
acc sessions show <session-id>
```

## CLI Commands

### Setup

| Command | Description |
|---------|-------------|
| `acc init` | Initialize ACC in current repository |
| `acc status` | Show ACC status and configuration |
| `acc scan` | Scan and index existing Claude sessions |

### Sessions

| Command | Description |
|---------|-------------|
| `acc sessions list` | List recent sessions |
| `acc sessions show <id>` | Show session details |
| `acc sessions active` | Show currently active session |
| `acc sessions link <session> <commit>` | Link session to commit |

### Upload

| Command | Description |
|---------|-------------|
| `acc upload` | Upload most recent session |
| `acc upload <id>` | Upload specific session |
| `acc upload --all` | Upload all local sessions |

### Git Hooks

| Command | Description |
|---------|-------------|
| `acc hooks install` | Install git hooks |
| `acc hooks uninstall` | Remove git hooks |

### Configuration

| Command | Description |
|---------|-------------|
| `acc config get [key]` | Get configuration value |
| `acc config set <key> <value>` | Set configuration value |

## GitHub Action

Automatically annotate your PRs with AI conversation context.

### Setup

Create `.github/workflows/ai-context.yml`:

```yaml
name: AI Commit Context

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  pull-requests: write
  contents: read

jobs:
  annotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: ai-commit-context/action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Example PR Comment

```markdown
## AI Development Context

This PR includes code developed with AI assistance.
Found **2 conversations** across **3 commits**.

| Commit | Conversation | Messages |
|--------|--------------|----------|
| `a1b2c3d` | [View](link) | 45 |
| `e5f6g7h` | [View](link) | 23 |
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      WORKFLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Work with Claude Code                                    │
│     └─> Sessions tracked in ~/.claude/projects/              │
│                                                              │
│  2. acc scan / acc watch                                     │
│     └─> Sessions indexed locally                             │
│                                                              │
│  3. git commit                                               │
│     └─> AI-Context-ID trailer added automatically            │
│                                                              │
│  4. acc upload                                               │
│     └─> Session uploaded to server                           │
│                                                              │
│  5. git push → Open PR                                       │
│     └─> GitHub Action adds context comment                   │
│                                                              │
│  6. Reviewer clicks link                                     │
│     └─> Sees full conversation in web viewer                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Self-Hosting

### Start the Server

```bash
cd acc/server
npm install
npm run build
npm start
```

Server runs on `http://localhost:3456` by default.

### Configure CLI

```bash
acc config set auth.apiUrl http://localhost:3456
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/sessions` | GET | List sessions |
| `/api/sessions` | POST | Upload session |
| `/api/sessions/:code` | GET | Get session |
| `/api/sessions/:code/commits` | POST | Link commit |
| `/api/commits/:sha/context` | GET | Get commit context |

## Configuration

Configuration is stored in `~/.acc/config.json`:

```json
{
  "auth": {
    "token": null,
    "apiUrl": "http://localhost:3456"
  },
  "preferences": {
    "autoUpload": true,
    "privacyMode": "private",
    "redactSecrets": true
  },
  "hooks": {
    "enabled": true,
    "autoLink": true,
    "trailerFormat": "AI-Context-ID"
  }
}
```

## Project Structure

```
acc/
├── src/                    # CLI source code
│   ├── cli/               # CLI commands
│   ├── db/                # JSON database
│   ├── hooks/             # Git hooks
│   ├── parser/            # JSONL parser
│   ├── upload/            # Upload service
│   ├── watcher/           # File watcher
│   └── utils/             # Utilities
├── server/                 # API server
│   └── src/
├── web/                    # Web viewer
├── github-action/          # GitHub Action
│   └── src/
└── package.json
```

## Roadmap

- [x] Phase 1: Local session tracking
- [x] Phase 2: Git integration
- [x] Phase 3: Cloud upload service
- [x] Phase 4: GitHub Action for PR annotation
- [x] Phase 5: Web viewer
- [ ] Phase 6: Team management
- [ ] Phase 7: Search functionality

## License

MIT
# test

x
