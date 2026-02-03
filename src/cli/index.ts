#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  getAllSessions,
  getSession,
  getActiveSession,
  getSessionFiles,
  getCommitSessions,
} from '../db/index.js';
import {
  startWatcher,
  stopWatcher,
  scanAllSessions,
  getWatcherStatus,
} from '../watcher/index.js';
import {
  installHooks,
  uninstallHooks,
  linkSessionToCommit,
  checkStagedFilesMatch,
  findGitRoot,
} from '../hooks/index.js';
import {
  loadConfig,
  updateConfig,
  formatRelativeTime,
  truncate,
  shortId,
  getClaudeProjectsPath,
} from '../utils/index.js';
import { uploadSession } from '../upload/index.js';

const program = new Command();

program
  .name('acc')
  .description('AI Commit Context - Connect Claude Code conversations to GitHub commits')
  .version('0.1.5');

// =============================================================================
// INIT COMMAND
// =============================================================================

program
  .command('init')
  .description('Initialize ACC in the current repository')
  .action(async () => {
    const gitRoot = findGitRoot();

    if (!gitRoot) {
      console.log(chalk.red('Error: Not in a git repository'));
      process.exit(1);
    }

    console.log(chalk.blue('Initializing AI Commit Context...'));
    console.log();

    // Install hooks
    const hookResult = installHooks(gitRoot);
    if (hookResult.success) {
      console.log(chalk.green('✓'), hookResult.message);
    } else {
      console.log(chalk.yellow('⚠'), hookResult.message);
    }

    // Scan existing sessions
    console.log('Scanning existing Claude sessions...');
    const count = await scanAllSessions();
    console.log(chalk.green('✓'), `Found ${count} session files`);

    console.log();
    console.log(chalk.green('ACC initialized successfully!'));
    console.log();
    console.log('Next steps:');
    console.log('  1. Start working with Claude Code as usual');
    console.log('  2. Your commits will automatically include AI context');
    console.log('  3. Run', chalk.cyan('acc sessions list'), 'to see indexed sessions');
  });

// =============================================================================
// SESSIONS COMMANDS
// =============================================================================

const sessions = program
  .command('sessions')
  .description('Manage Claude Code sessions');

sessions
  .command('list')
  .description('List recent sessions')
  .option('-n, --limit <number>', 'Number of sessions to show', '10')
  .action((options) => {
    const limit = parseInt(options.limit, 10);
    const sessionList = getAllSessions(limit);

    if (sessionList.length === 0) {
      console.log(chalk.yellow('No sessions found.'));
      console.log('Run', chalk.cyan('acc scan'), 'to index existing sessions.');
      return;
    }

    console.log(chalk.bold(`Recent Sessions (${sessionList.length}):`));
    console.log();

    for (const session of sessionList) {
      const id = chalk.cyan(shortId(session.id));
      const time = chalk.gray(formatRelativeTime(session.startedAt));
      const messages = chalk.yellow(`${session.messageCount} msgs`);
      const files = session.filesModified.length > 0
        ? chalk.blue(`${session.filesModified.length} files`)
        : chalk.gray('no files');
      const uploaded = session.uploaded
        ? chalk.green('✓ uploaded')
        : chalk.gray('local');

      console.log(`  ${id}  ${time}  ${messages}  ${files}  ${uploaded}`);

      if (session.filesModified.length > 0) {
        const preview = session.filesModified.slice(0, 3).map(f => truncate(f, 40)).join(', ');
        console.log(chalk.gray(`           ${preview}`));
      }
    }
  });

sessions
  .command('show <id>')
  .description('Show details of a specific session')
  .action((id) => {
    // Find session by partial ID
    const allSessions = getAllSessions(100);
    const session = allSessions.find(s => s.id.startsWith(id));

    if (!session) {
      console.log(chalk.red(`Session not found: ${id}`));
      process.exit(1);
    }

    console.log(chalk.bold('Session Details:'));
    console.log();
    console.log('  ID:        ', chalk.cyan(session.id));
    console.log('  Project:   ', session.projectPath);
    console.log('  Started:   ', formatRelativeTime(session.startedAt));
    console.log('  Ended:     ', session.endedAt ? formatRelativeTime(session.endedAt) : chalk.gray('active'));
    console.log('  Messages:  ', session.messageCount);
    console.log('  Uploaded:  ', session.uploaded ? chalk.green('Yes') : chalk.gray('No'));

    if (session.uploadUrl) {
      console.log('  URL:       ', chalk.blue(session.uploadUrl));
    }

    console.log();
    console.log(chalk.bold('Files Modified:'));
    const files = getSessionFiles(session.id);

    if (files.length === 0) {
      console.log(chalk.gray('  No file operations recorded'));
    } else {
      const grouped = files.reduce((acc, f) => {
        if (!acc[f.filePath]) acc[f.filePath] = [];
        acc[f.filePath].push(f.operation);
        return acc;
      }, {} as Record<string, string[]>);

      for (const [filePath, ops] of Object.entries(grouped)) {
        const uniqueOps = [...new Set(ops)].join(', ');
        console.log(`  ${chalk.yellow(uniqueOps.padEnd(12))} ${filePath}`);
      }
    }
  });

sessions
  .command('active')
  .description('Show the currently active session')
  .option('--format <format>', 'Output format: full, id', 'full')
  .action((options) => {
    const session = getActiveSession();

    if (!session) {
      if (options.format === 'id') {
        // Silent exit for scripts
        process.exit(1);
      }
      console.log(chalk.yellow('No active session'));
      return;
    }

    if (options.format === 'id') {
      console.log(session.id);
      return;
    }

    console.log(chalk.bold('Active Session:'));
    console.log('  ID:       ', chalk.cyan(shortId(session.id)));
    console.log('  Started:  ', formatRelativeTime(session.startedAt));
    console.log('  Messages: ', session.messageCount);
  });

sessions
  .command('link <sessionId> <commitSha>')
  .description('Link a session to a commit')
  .action((sessionId, commitSha) => {
    const result = linkSessionToCommit(sessionId, commitSha);

    if (result.success) {
      console.log(chalk.green('✓'), result.message);
    } else {
      console.log(chalk.red('✗'), result.message);
      process.exit(1);
    }
  });

sessions
  .command('check-files <sessionId> [files...]')
  .description('Check if files match a session')
  .action((sessionId, files) => {
    if (!files || files.length === 0) {
      process.exit(1);
    }

    const matched = checkStagedFilesMatch(sessionId, files);

    if (matched.length > 0) {
      console.log(matched.join('\n'));
    }
  });

sessions
  .command('url <sessionId>')
  .description('Get the URL for a session')
  .action((sessionId) => {
    const session = getSession(sessionId);

    if (!session) {
      process.exit(1);
    }

    if (session.uploadUrl) {
      console.log(session.uploadUrl);
    }
  });

// =============================================================================
// HOOKS COMMANDS
// =============================================================================

const hooks = program
  .command('hooks')
  .description('Manage git hooks');

hooks
  .command('install')
  .description('Install git hooks in current repository')
  .action(() => {
    const result = installHooks();

    if (result.success) {
      console.log(chalk.green('✓'), result.message);
    } else {
      console.log(chalk.red('✗'), result.message);
      process.exit(1);
    }
  });

hooks
  .command('uninstall')
  .description('Remove git hooks from current repository')
  .action(() => {
    const result = uninstallHooks();

    if (result.success) {
      console.log(chalk.green('✓'), result.message);
    } else {
      console.log(chalk.red('✗'), result.message);
      process.exit(1);
    }
  });

// =============================================================================
// SCAN COMMAND
// =============================================================================

program
  .command('scan')
  .description('Scan and index all Claude Code sessions')
  .action(async () => {
    console.log('Scanning Claude sessions...');

    const claudePath = getClaudeProjectsPath();
    const count = await scanAllSessions(claudePath);

    console.log(chalk.green('✓'), `Indexed ${count} session files`);
  });

// =============================================================================
// UPLOAD COMMAND
// =============================================================================

program
  .command('upload [sessionId]')
  .description('Upload a session to the server')
  .option('--all', 'Upload all local sessions')
  .action(async (sessionId, options) => {
    if (options.all) {
      // Upload all unuploaded sessions
      const sessions = getAllSessions(100).filter(s => !s.uploaded);

      if (sessions.length === 0) {
        console.log(chalk.yellow('No sessions to upload.'));
        return;
      }

      console.log(`Uploading ${sessions.length} sessions...`);

      for (const session of sessions) {
        process.stdout.write(`  ${shortId(session.id)}... `);
        const result = await uploadSession(session.id);

        if (result.success) {
          console.log(chalk.green('✓'), result.url);
        } else {
          console.log(chalk.red('✗'), result.error);
        }
      }
      return;
    }

    if (!sessionId) {
      // Upload most recent session
      const sessions = getAllSessions(1);
      if (sessions.length === 0) {
        console.log(chalk.red('No sessions found. Run'), chalk.cyan('acc scan'), chalk.red('first.'));
        process.exit(1);
      }
      sessionId = sessions[0].id;
    }

    // Find session by partial ID
    const allSessions = getAllSessions(100);
    const session = allSessions.find(s => s.id.startsWith(sessionId));

    if (!session) {
      console.log(chalk.red(`Session not found: ${sessionId}`));
      process.exit(1);
    }

    console.log(`Uploading session ${shortId(session.id)}...`);

    const result = await uploadSession(session.id);

    if (result.success) {
      console.log();
      console.log(chalk.green('✓'), 'Session uploaded successfully!');
      console.log();
      console.log('  URL:', chalk.blue(result.url));
      console.log('  Code:', chalk.cyan(result.shortCode));
    } else {
      console.log(chalk.red('✗'), 'Upload failed:', result.error);
      process.exit(1);
    }
  });

// =============================================================================
// WATCH COMMAND
// =============================================================================

program
  .command('watch')
  .description('Start watching for new sessions')
  .action(() => {
    console.log(chalk.blue('Starting session watcher...'));
    console.log('Press Ctrl+C to stop');
    console.log();

    startWatcher();

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log();
      await stopWatcher();
      process.exit(0);
    });
  });

// =============================================================================
// STATUS COMMAND
// =============================================================================

program
  .command('status')
  .description('Show ACC status')
  .action(() => {
    const config = loadConfig();
    const watcherStatus = getWatcherStatus();
    const gitRoot = findGitRoot();
    const recentSessions = getAllSessions(5);

    console.log(chalk.bold('AI Commit Context Status'));
    console.log();

    // Git repository
    if (gitRoot) {
      console.log(chalk.green('✓'), 'Git repository:', gitRoot);
    } else {
      console.log(chalk.yellow('⚠'), 'Not in a git repository');
    }

    // Watcher
    if (watcherStatus.running) {
      console.log(chalk.green('✓'), 'Watcher:', 'running');
    } else {
      console.log(chalk.gray('○'), 'Watcher:', 'stopped');
    }

    // Sessions
    console.log(chalk.blue('ℹ'), 'Recent sessions:', recentSessions.length);

    // Config
    console.log();
    console.log(chalk.bold('Configuration:'));
    console.log('  Auto upload: ', config.preferences.autoUpload ? 'Yes' : 'No');
    console.log('  Privacy mode:', config.preferences.privacyMode);
    console.log('  Hooks enabled:', config.hooks.enabled ? 'Yes' : 'No');
  });

// =============================================================================
// CONFIG COMMAND
// =============================================================================

const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('get [key]')
  .description('Get configuration value')
  .action((key) => {
    const config = loadConfig();

    if (!key) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    const keys = key.split('.');
    let value: unknown = config;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        console.log(chalk.red(`Key not found: ${key}`));
        process.exit(1);
      }
    }

    console.log(value);
  });

configCmd
  .command('set <key> <value>')
  .description('Set configuration value')
  .action((key, value) => {
    // Parse value
    let parsedValue: unknown = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    updateConfig(key, parsedValue);
    console.log(chalk.green('✓'), `Set ${key} = ${value}`);
  });

// =============================================================================
// LOG COMMAND
// =============================================================================

program
  .command('log')
  .description('Show commits with AI context')
  .option('-n, --limit <number>', 'Number of commits to check', '10')
  .action(() => {
    const gitRoot = findGitRoot();

    if (!gitRoot) {
      console.log(chalk.red('Not in a git repository'));
      process.exit(1);
    }

    // This would parse git log and look for AI-Context-ID trailers
    console.log(chalk.yellow('Coming soon: Show commits with linked AI conversations'));
    console.log();
    console.log('For now, use:');
    console.log(chalk.cyan('  git log --format="%h %s %(trailers:key=AI-Context-ID,valueonly)"'));
  });

// =============================================================================
// SHOW COMMAND
// =============================================================================

program
  .command('show <commit>')
  .description('Show AI context for a commit')
  .action((commit) => {
    const commitSessions = getCommitSessions(commit);

    if (commitSessions.length === 0) {
      console.log(chalk.yellow('No AI context found for this commit'));
      return;
    }

    console.log(chalk.bold(`AI Context for ${commit}:`));
    console.log();

    for (const session of commitSessions) {
      console.log('  Session:', chalk.cyan(shortId(session.id)));
      console.log('  Time:   ', formatRelativeTime(session.startedAt));
      console.log('  Messages:', session.messageCount);

      if (session.uploadUrl) {
        console.log('  URL:    ', chalk.blue(session.uploadUrl));
      }

      console.log();
    }
  });

// Parse arguments
program.parse();
