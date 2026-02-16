// Core types for AI Commit Context

export interface SessionEvent {
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  type: 'user' | 'assistant' | 'system';
}

export interface UserMessage extends SessionEvent {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
}

export interface ToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export type ContentBlock = TextBlock | ToolUse | ToolResult;

export interface AssistantMessage extends SessionEvent {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: string | ContentBlock[];
  };
}

export type ClaudeMessage = UserMessage | AssistantMessage;

export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  startedAt: Date;
  endedAt: Date | null;
  messageCount: number;
  filesModified: string[];
  uploaded: boolean;
  uploadUrl: string | null;
}

export interface SessionFile {
  id?: number;
  sessionId: string;
  filePath: string;
  operation: 'read' | 'write' | 'edit';
  timestamp: Date;
}

export interface SessionCommit {
  sessionId: string;
  commitSha: string;
  repoPath: string;
  createdAt: Date;
}

export interface WatcherConfig {
  claudeProjectsPath: string;
  pollInterval: number;
  dbPath: string;
}

export interface Config {
  auth: {
    token: string | null;
    apiUrl: string;
  };
  preferences: {
    autoUpload: boolean;
    privacyMode: 'public' | 'team' | 'private';
    redactSecrets: boolean;
    includeToolOutputs: boolean;
  };
  hooks: {
    enabled: boolean;
    autoLink: boolean;
    trailerFormat: string;
  };
}

export const DEFAULT_CONFIG: Config = {
  auth: {
    token: null,
    apiUrl: 'https://aicommitcontext.dev',
  },
  preferences: {
    autoUpload: true,
    privacyMode: 'private',
    redactSecrets: true,
    includeToolOutputs: false,
  },
  hooks: {
    enabled: true,
    autoLink: true,
    trailerFormat: 'AI-Context-ID',
  },
};
