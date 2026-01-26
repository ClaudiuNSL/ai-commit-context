import fs from 'fs';
import readline from 'readline';
import path from 'path';
import type { ClaudeMessage, ContentBlock, ToolUse, Session, SessionFile } from '../types.js';

interface ParsedSession {
  id: string;
  projectPath: string;
  messages: ClaudeMessage[];
  filesModified: SessionFile[];
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Parse a Claude Code JSONL session file
 */
export async function parseSessionFile(filePath: string): Promise<ParsedSession | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const messages: ClaudeMessage[] = [];
  const filesModified: SessionFile[] = [];
  let sessionId = '';
  let startedAt: Date | null = null;
  let endedAt: Date | null = null;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Extract session ID from first message
      if (!sessionId && entry.uuid) {
        sessionId = entry.uuid;
      }

      // Track timestamps
      if (entry.timestamp) {
        const timestamp = new Date(entry.timestamp);
        if (!startedAt || timestamp < startedAt) {
          startedAt = timestamp;
        }
        if (!endedAt || timestamp > endedAt) {
          endedAt = timestamp;
        }
      }

      // Parse message
      if (entry.type === 'user' || entry.type === 'assistant') {
        messages.push(entry as ClaudeMessage);

        // Extract file operations from assistant messages
        if (entry.type === 'assistant' && entry.message?.content) {
          const content = entry.message.content;
          if (Array.isArray(content)) {
            for (const block of content as ContentBlock[]) {
              if (block.type === 'tool_use') {
                const toolUse = block as ToolUse;
                const fileOp = extractFileOperation(toolUse, entry.timestamp);
                if (fileOp) {
                  filesModified.push({
                    sessionId,
                    ...fileOp,
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  if (!sessionId || messages.length === 0) {
    return null;
  }

  // Extract project path from file location
  const projectPath = path.dirname(path.dirname(filePath));

  return {
    id: sessionId,
    projectPath,
    messages,
    filesModified,
    startedAt: startedAt || new Date(),
    endedAt,
  };
}

/**
 * Extract file operation from a tool use block
 */
function extractFileOperation(
  toolUse: ToolUse,
  timestamp: string
): Omit<SessionFile, 'sessionId' | 'id'> | null {
  const input = toolUse.input as Record<string, unknown>;

  switch (toolUse.name) {
    case 'Read':
      if (input.file_path) {
        return {
          filePath: input.file_path as string,
          operation: 'read',
          timestamp: new Date(timestamp),
        };
      }
      break;

    case 'Write':
      if (input.file_path) {
        return {
          filePath: input.file_path as string,
          operation: 'write',
          timestamp: new Date(timestamp),
        };
      }
      break;

    case 'Edit':
    case 'MultiEdit':
      if (input.file_path) {
        return {
          filePath: input.file_path as string,
          operation: 'edit',
          timestamp: new Date(timestamp),
        };
      }
      break;
  }

  return null;
}

/**
 * Get all session files from Claude projects directory
 */
export function getClaudeSessionFiles(claudeProjectsPath: string): string[] {
  if (!fs.existsSync(claudeProjectsPath)) {
    return [];
  }

  const sessionFiles: string[] = [];

  const projects = fs.readdirSync(claudeProjectsPath);
  for (const project of projects) {
    const projectDir = path.join(claudeProjectsPath, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const files = fs.readdirSync(projectDir);
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        sessionFiles.push(path.join(projectDir, file));
      }
    }
  }

  return sessionFiles;
}

/**
 * Convert parsed session to database session format
 */
export function toSession(parsed: ParsedSession): Omit<Session, 'uploaded' | 'uploadUrl'> {
  return {
    id: parsed.id,
    projectPath: parsed.projectPath,
    projectName: path.basename(parsed.projectPath),
    startedAt: parsed.startedAt,
    endedAt: parsed.endedAt,
    messageCount: parsed.messages.length,
    filesModified: [...new Set(parsed.filesModified.map(f => f.filePath))],
  };
}

/**
 * Extract conversation text (user messages only) for summary
 */
export function extractConversationText(messages: ClaudeMessage[]): string {
  return messages
    .filter(m => m.type === 'user')
    .map(m => {
      if (typeof m.message.content === 'string') {
        return m.message.content;
      }
      return '';
    })
    .join('\n\n');
}

/**
 * Get a summary of the session (first user message truncated)
 */
export function getSessionSummary(messages: ClaudeMessage[], maxLength = 100): string {
  const firstUserMessage = messages.find(m => m.type === 'user');
  if (!firstUserMessage) return 'Empty session';

  const content = firstUserMessage.message.content;
  const text = typeof content === 'string' ? content : 'Complex message';

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}
