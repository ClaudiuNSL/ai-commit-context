import os from 'os';
import path from 'path';
import fs from 'fs';
import type { Config } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';

const ACC_DIR = path.join(os.homedir(), '.acc');
const CONFIG_PATH = path.join(ACC_DIR, 'config.json');

/**
 * Ensure ACC directory exists
 */
export function ensureAccDir(): void {
  if (!fs.existsSync(ACC_DIR)) {
    fs.mkdirSync(ACC_DIR, { recursive: true });
  }
}

/**
 * Load configuration
 */
export function loadConfig(): Config {
  ensureAccDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const loaded = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...loaded };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration
 */
export function saveConfig(config: Config): void {
  ensureAccDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/**
 * Update specific config value
 */
export function updateConfig(key: string, value: unknown): void {
  const config = loadConfig();
  const keys = key.split('.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  saveConfig(config);
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleString();
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Generate short ID from UUID
 */
export function shortId(uuid: string): string {
  return uuid.substring(0, 8);
}

/**
 * Redact sensitive information from text
 */
export function redactSecrets(text: string): string {
  const patterns = [
    // API Keys
    { regex: /(?:api[_-]?key|apikey)["\s:=]+["']?([\w-]{20,})["']?/gi, replacement: '[REDACTED_API_KEY]' },
    // AWS Keys
    { regex: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
    // Private keys
    { regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
    // Passwords in URLs
    { regex: /:\/\/([^:]+):([^@]+)@/g, replacement: '://$1:[REDACTED]@' },
    // Generic secrets
    { regex: /(?:password|secret|token)["\s:=]+["']?([^\s"']{8,})["']?/gi, replacement: '$&'.replace(/[^\s"']{8,}/, '[REDACTED]') },
  ];

  let result = text;
  for (const { regex, replacement } of patterns) {
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Check if a path is inside another path
 */
export function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Get Claude projects path
 */
export function getClaudeProjectsPath(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

export { ACC_DIR, CONFIG_PATH };
