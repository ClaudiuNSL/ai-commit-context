# Commit Context Plugin

A Claude Code plugin that automatically links your conversations to GitHub commits for better code review context.

## Installation

### From GitHub

```bash
claude plugins install github:AI-Commit-Context/ai-commit-context
```

### Manual Installation

1. Clone this repository
2. Navigate to the plugin directory
3. Run `claude plugins install .`

## Features

- **Automatic Session Tracking**: Tracks files modified during Claude Code sessions
- **Git Hook Integration**: Automatically adds AI context trailers to commit messages
- **GitHub Integration**: Links conversations to pull requests via GitHub Actions

## How It Works

1. When you start a Claude Code session, the plugin begins tracking file modifications
2. When you commit, the plugin uploads your conversation and adds a context trailer
3. The GitHub Action picks up the trailer and adds a link to your PR

## Authentication

On first commit, the plugin will prompt you to authenticate with GitHub. This creates an API key stored in `~/.acc/config.json`.

## Configuration

Configuration is stored in `~/.acc/config.json`:

```json
{
  "apiKey": "acc_...",
  "apiUrl": "https://ai-commit-context.vercel.app"
}
```

## Hooks

This plugin uses the following Claude Code hooks:

- **SessionStart**: Initializes session tracking
- **PostToolUse**: Tracks file modifications from Write, Edit, and Bash tools
- **Stop**: Cleans up session state

## Git Hook

The plugin installs a `prepare-commit-msg` hook that:
1. Reads the active session state
2. Uploads the conversation to the API
3. Appends `AI-Context-ID` and `AI-Context-URL` trailers to your commit

## Troubleshooting

### Commits are slow

The plugin uploads your conversation synchronously. If upload fails, commits proceed normally without the context trailer.

### Authentication issues

Run `acc logout` to clear credentials and re-authenticate on next commit.

## License

MIT
