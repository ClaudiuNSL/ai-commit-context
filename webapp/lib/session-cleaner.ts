import type { CleanMessage, RawMessage, ContentBlock, ToolUseBlock, TextBlock } from './types'

// File modification tool names
const FILE_MODIFICATION_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

/**
 * Extract file path from a tool use block if it's a file modification operation
 */
function extractFilePath(toolUse: ToolUseBlock): string | null {
  if (!FILE_MODIFICATION_TOOLS.includes(toolUse.name)) {
    return null
  }

  const input = toolUse.input
  if (typeof input === 'object' && input !== null) {
    // Handle different tool input formats
    if ('file_path' in input && typeof input.file_path === 'string') {
      return input.file_path
    }
    if ('notebook_path' in input && typeof input.notebook_path === 'string') {
      return input.notebook_path
    }
    if ('relative_path' in input && typeof input.relative_path === 'string') {
      return input.relative_path
    }
  }

  return null
}

/**
 * Extract text content from assistant message content blocks
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content
  }

  const textBlocks = content.filter(
    (block): block is TextBlock => block.type === 'text'
  )

  return textBlocks.map((block) => block.text).join('\n\n')
}

/**
 * Extract files modified from assistant message content blocks
 */
function extractFilesModified(content: string | ContentBlock[]): string[] {
  if (typeof content === 'string') {
    return []
  }

  const files: string[] = []

  for (const block of content) {
    if (block.type === 'tool_use') {
      const filePath = extractFilePath(block as ToolUseBlock)
      if (filePath) {
        files.push(filePath)
      }
    }
  }

  // Return unique files
  return Array.from(new Set(files))
}

/**
 * Clean raw messages from Claude Code JSONL format
 *
 * Extracts only user prompts and assistant text responses.
 * Detects file modifications from tool_use blocks.
 * Strips internal metadata, thinking blocks, and system messages.
 */
export function cleanMessages(rawMessages: RawMessage[]): CleanMessage[] {
  const cleanedMessages: CleanMessage[] = []

  for (const msg of rawMessages) {
    // Skip system messages
    if (msg.type === 'system') {
      continue
    }

    // Process user messages
    if (msg.type === 'user') {
      const content = typeof msg.message.content === 'string'
        ? msg.message.content
        : extractTextContent(msg.message.content)

      // Skip empty messages
      if (!content.trim()) {
        continue
      }

      cleanedMessages.push({
        role: 'user',
        content: content.trim(),
        timestamp: msg.timestamp,
      })
      continue
    }

    // Process assistant messages
    if (msg.type === 'assistant') {
      const content = extractTextContent(msg.message.content)
      const filesModified = extractFilesModified(msg.message.content)

      // Skip messages with no text content (pure tool calls)
      if (!content.trim()) {
        // But if there are file modifications, create a minimal entry
        if (filesModified.length > 0) {
          cleanedMessages.push({
            role: 'assistant',
            content: `[Modified ${filesModified.length} file(s)]`,
            filesModified,
            timestamp: msg.timestamp,
          })
        }
        continue
      }

      const cleanedMessage: CleanMessage = {
        role: 'assistant',
        content: content.trim(),
        timestamp: msg.timestamp,
      }

      if (filesModified.length > 0) {
        cleanedMessage.filesModified = filesModified
      }

      cleanedMessages.push(cleanedMessage)
    }
  }

  return cleanedMessages
}

/**
 * Extract the first user message from raw messages
 *
 * Finds the first human message and truncates to ~100 characters for preview.
 * Returns empty string if no user message found.
 */
export function extractFirstUserMessage(messages: RawMessage[], maxLength = 100): string {
  const firstUserMessage = messages.find((msg) => msg.type === 'user')

  if (!firstUserMessage) {
    return ''
  }

  const content = firstUserMessage.message.content
  const text = typeof content === 'string'
    ? content
    : extractTextContent(content)

  const trimmedText = text.trim()

  if (!trimmedText) {
    return ''
  }

  if (trimmedText.length <= maxLength) {
    return trimmedText
  }

  // Truncate at word boundary if possible
  const truncated = trimmedText.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...'
  }

  return truncated.substring(0, maxLength - 3) + '...'
}

/**
 * Get all unique files modified across all messages
 */
export function getAllFilesModified(cleanMessages: CleanMessage[]): string[] {
  const files = new Set<string>()

  for (const msg of cleanMessages) {
    if (msg.filesModified) {
      for (const file of msg.filesModified) {
        files.add(file)
      }
    }
  }

  return Array.from(files).sort()
}
