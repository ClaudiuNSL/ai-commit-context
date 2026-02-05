#!/usr/bin/env node

/**
 * Authentication Flow for Commit Context Plugin
 *
 * Handles GitHub OAuth device flow for CLI authentication.
 *
 * Usage:
 *   auth-flow.js check    - Check if authenticated
 *   auth-flow.js login    - Start auth flow
 *   auth-flow.js logout   - Clear credentials
 *   auth-flow.js status   - Show auth status
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import https from 'https';
import http from 'http';
import { execFileSync } from 'child_process';

const ACC_DIR = join(homedir(), '.acc');
const CONFIG_FILE = join(ACC_DIR, 'config.json');
const DEFAULT_API_URL = 'https://ai-commit-context.vercel.app';

/**
 * Ensure the .acc directory exists
 */
function ensureAccDir() {
  if (!existsSync(ACC_DIR)) {
    mkdirSync(ACC_DIR, { recursive: true });
  }
}

/**
 * Load configuration
 */
function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return { apiUrl: DEFAULT_API_URL };
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

/**
 * Save configuration
 */
function saveConfig(config) {
  ensureAccDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Make HTTP request
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const req = protocol.request(parsedUrl, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Open URL in browser
 */
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      execFileSync('open', [url]);
    } else if (platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', url]);
    } else {
      execFileSync('xdg-open', [url]);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep for ms milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if authenticated
 */
function checkAuth() {
  const config = loadConfig();
  if (config.apiKey) {
    console.log(JSON.stringify({ authenticated: true, user: config.username }));
    return true;
  }
  console.log(JSON.stringify({ authenticated: false }));
  return false;
}

/**
 * Start authentication flow
 */
async function startAuthFlow() {
  const config = loadConfig();
  const apiUrl = config.apiUrl || DEFAULT_API_URL;

  console.log('Starting authentication...\n');

  try {
    // Request device code
    const deviceResponse = await request(`${apiUrl}/api/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    });

    const { deviceCode, verificationUrl } = deviceResponse;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Your verification code is:');
    console.log(`  ${deviceCode}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\nOpen this URL to authenticate:\n${verificationUrl}\n`);

    // Try to open browser
    const opened = openBrowser(verificationUrl);
    if (opened) {
      console.log('Browser opened automatically.');
    } else {
      console.log('Please open the URL manually in your browser.');
    }

    console.log('\nWaiting for authentication...');

    // Poll for completion
    const maxAttempts = 60; // 2 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000);

      try {
        const pollResponse = await request(`${apiUrl}/api/auth/poll/${deviceCode}`);

        if (pollResponse.status === 'pending') {
          process.stdout.write('.');
          continue;
        }

        if (pollResponse.apiKey) {
          console.log('\n\n✓ Authentication successful!\n');

          // Save credentials
          config.apiKey = pollResponse.apiKey;
          config.userId = pollResponse.userId;
          config.username = pollResponse.username;
          saveConfig(config);

          console.log(`Logged in as: ${pollResponse.username}`);
          console.log(`Credentials saved to: ${CONFIG_FILE}`);
          return true;
        }

        if (pollResponse.error === 'expired') {
          console.log('\n\n✗ Verification code expired. Please try again.');
          return false;
        }
      } catch (err) {
        // Continue polling on errors
        process.stdout.write('.');
      }
    }

    console.log('\n\n✗ Authentication timed out. Please try again.');
    return false;
  } catch (err) {
    console.error(`\nAuthentication failed: ${err.message}`);
    return false;
  }
}

/**
 * Logout - clear credentials
 */
function logout() {
  if (existsSync(CONFIG_FILE)) {
    const config = loadConfig();
    delete config.apiKey;
    delete config.userId;
    delete config.username;
    saveConfig(config);
    console.log('Logged out successfully.');
  } else {
    console.log('Not logged in.');
  }
}

/**
 * Show auth status
 */
function showStatus() {
  const config = loadConfig();

  console.log('Commit Context Authentication Status\n');
  console.log(`Config file: ${CONFIG_FILE}`);
  console.log(`API URL: ${config.apiUrl || DEFAULT_API_URL}`);

  if (config.apiKey) {
    console.log(`\nStatus: Authenticated`);
    console.log(`User: ${config.username || 'Unknown'}`);
    console.log(`API Key: ${config.apiKey.substring(0, 8)}...`);
  } else {
    console.log(`\nStatus: Not authenticated`);
    console.log(`\nRun 'auth-flow.js login' to authenticate.`);
  }

  // Check for pending uploads
  const pendingDir = join(ACC_DIR, 'pending');
  if (existsSync(pendingDir)) {
    const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      console.log(`\n${files.length} session(s) pending upload`);
      console.log(`Run 'auth-flow.js sync' to upload them.`);
    }
  }
}

/**
 * Sync pending sessions
 */
async function syncPendingSessions() {
  const config = loadConfig();

  if (!config.apiKey) {
    console.log('Not authenticated. Run "auth-flow.js login" first.');
    return false;
  }

  const pendingDir = join(ACC_DIR, 'pending');
  if (!existsSync(pendingDir)) {
    console.log('No pending sessions to upload.');
    return true;
  }

  const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No pending sessions to upload.');
    return true;
  }

  console.log(`Uploading ${files.length} pending session(s)...\n`);

  const apiUrl = config.apiUrl || DEFAULT_API_URL;
  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filepath = join(pendingDir, file);
    try {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      const { session, messages } = data;

      const result = await request(`${apiUrl}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: {
          sessionId: session.sessionId,
          projectName: session.projectName || 'unknown',
          messages,
          repos: session.repos,
          startedAt: session.startedAt,
          endedAt: session.endedAt || new Date().toISOString()
        }
      });

      if (result.shortCode) {
        console.log(`✓ ${session.sessionId.substring(0, 20)}... → ${apiUrl}/s/${result.shortCode}`);
        unlinkSync(filepath);
        success++;
      } else {
        console.log(`✗ ${session.sessionId.substring(0, 20)}... - No shortCode returned`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${file} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nCompleted: ${success} uploaded, ${failed} failed`);
  return failed === 0;
}

// Main CLI handler
const command = process.argv[2];

switch (command) {
  case 'check':
    checkAuth();
    break;
  case 'login':
    startAuthFlow().then(success => process.exit(success ? 0 : 1));
    break;
  case 'logout':
    logout();
    break;
  case 'status':
    showStatus();
    break;
  case 'sync':
    syncPendingSessions().then(success => process.exit(success ? 0 : 1));
    break;
  case '--help':
  case '-h':
    console.log(`
Authentication Flow for Commit Context Plugin

Usage:
  auth-flow.js check    - Check if authenticated (returns JSON)
  auth-flow.js login    - Start auth flow
  auth-flow.js logout   - Clear credentials
  auth-flow.js status   - Show auth status
  auth-flow.js sync     - Upload pending sessions
`);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log('Run with --help for usage information.');
    process.exit(1);
}
