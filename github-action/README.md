# AI Commit Context - GitHub Action

Automatically annotate your pull requests with AI conversation context from Claude Code sessions.

## What it does

When you work with Claude Code and commit your changes with AI context trailers, this action:

1. Scans commits in your PR for `AI-Context-ID` trailers
2. Fetches conversation details from the AI Commit Context API
3. Adds a comment to your PR with links to view the full conversations

## Example PR Comment

```
## AI Development Context

This PR includes code developed with AI assistance. Found **2 conversations** across **3 commits**.

| Commit | Conversation | Messages | Files |
|--------|--------------|----------|-------|
| `a1b2c3d` | [View conversation](link) | 45 | auth.ts |
| `e5f6g7h` | [View conversation](link) | 23 | middleware.ts |

<details>
<summary>View conversation excerpts</summary>

### Commit `a1b2c3d`

> I need to implement JWT authentication with refresh tokens...

[View full conversation →](link)

</details>
```

## Usage

### Basic Setup

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
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Annotate PR with AI Context
        uses: ai-commit-context/action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With Custom API

If you're self-hosting the AI Commit Context server:

```yaml
- name: Annotate PR with AI Context
  uses: ai-commit-context/action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    api-url: https://your-server.com
    api-token: ${{ secrets.ACC_API_TOKEN }}
```

### All Options

```yaml
- name: Annotate PR with AI Context
  uses: ai-commit-context/action@v1
  with:
    # Required: GitHub token
    github-token: ${{ secrets.GITHUB_TOKEN }}

    # API server URL (default: https://api.aicommitcontext.dev)
    api-url: https://api.aicommitcontext.dev

    # Optional API authentication token
    api-token: ${{ secrets.ACC_API_TOKEN }}

    # Comment mode: create, update, or none (default: update)
    comment-mode: update

    # Show conversation excerpts in collapsed section (default: true)
    show-excerpts: true

    # Git trailer key to search for (default: AI-Context-ID)
    trailer-key: AI-Context-ID
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `api-url` | AI Commit Context API URL | No | `https://api.aicommitcontext.dev` |
| `api-token` | API token for authentication | No | - |
| `comment-mode` | How to handle comments: `create`, `update`, `none` | No | `update` |
| `show-excerpts` | Show conversation excerpts | No | `true` |
| `trailer-key` | Git trailer key to look for | No | `AI-Context-ID` |

## Outputs

| Output | Description |
|--------|-------------|
| `sessions-found` | Number of AI sessions found in the PR |
| `comment-url` | URL of the created/updated PR comment |

## How Commits Are Linked

For this action to work, your commits need to include AI context trailers. The `acc` CLI tool does this automatically when you have hooks installed:

```
feat: implement user authentication

Implemented JWT-based authentication with refresh token support.

AI-Context-ID: 550e8400-e29b-41d4-a716-446655440000
AI-Context-URL: https://aicommitcontext.dev/c/abc123
```

### Setting Up the CLI

```bash
# Install the CLI
npm install -g @ai-commit-context/cli

# Initialize in your repo
cd your-project
acc init

# Now commits will automatically include AI context!
```

## Development

```bash
# Install dependencies
npm install

# Build the action
npm run build
```

## License

MIT
