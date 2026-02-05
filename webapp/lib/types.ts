// Types for AI Commit Context webapp

export type CleanMessage = {
  role: 'user' | 'assistant'
  content: string
  filesModified?: string[]
  timestamp?: string
}

export type RepoInfo = {
  name: string
  owner: string
  branch: string
  filesModified: string[]
  commitSha?: string
}

export type Session = {
  id: string
  shortCode: string
  sessionId: string
  projectName: string
  messages: RawMessage[]
  cleanMessages?: CleanMessage[]
  repos?: RepoInfo[]
  firstUserMessage?: string
  startedAt: string
  endedAt?: string
  createdAt: string
}

// Raw message types from Claude Code JSONL format
export type TextBlock = {
  type: 'text'
  text: string
}

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type ThinkingBlock = {
  type: 'thinking'
  thinking: string
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock

export type RawMessage = {
  uuid: string
  parentUuid: string | null
  timestamp: string
  type: 'user' | 'assistant' | 'system'
  message: {
    role: 'user' | 'assistant' | 'system'
    content: string | ContentBlock[]
  }
}
