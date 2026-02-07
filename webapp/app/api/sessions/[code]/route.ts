import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

interface ContentBlock {
  type: string
  text?: string
}

interface ToolUseBlock {
  type: 'tool_use'
  name: string
  input?: {
    file_path?: string
    path?: string
  }
}

interface MessageEntry {
  type?: string
  role?: string
  message?: {
    role?: string
    content?: string | ContentBlock[]
  }
  content?: string | ContentBlock[]
  timestamp?: string
}

interface CleanMessage {
  role: 'user' | 'assistant'
  content: string
  filesModified?: string[]
  timestamp?: string
}

/**
 * Extract text content from message content (handles arrays and strings)
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .filter((block): block is ContentBlock => block.type === 'text')
      .map(block => block.text || '')
      .join('\n')
  }

  return ''
}

/**
 * Extract file paths from tool_use blocks
 */
function extractFilesFromContent(content: unknown): string[] {
  const files: string[] = []

  if (!Array.isArray(content)) {
    return files
  }

  for (const block of content) {
    if (block.type === 'tool_use') {
      const toolBlock = block as ToolUseBlock
      const input = toolBlock.input || {}
      const filePath = input.file_path || input.path
      if (filePath && !files.includes(filePath)) {
        // Extract just the filename for cleaner display
        const parts = filePath.split('/')
        files.push(parts[parts.length - 1] || filePath)
      }
    }
  }

  return files
}

/**
 * Clean messages for display
 */
function cleanMessages(messages: MessageEntry[]): CleanMessage[] {
  const cleaned: CleanMessage[] = []

  for (const m of messages) {
    const isAssistant = m.message?.role === 'assistant' || m.type === 'assistant' || m.role === 'assistant'
    const isUser = m.message?.role === 'user' || m.type === 'human' || m.type === 'user' || m.role === 'user'

    if (!isAssistant && !isUser) continue

    const rawContent = m.message?.content || m.content
    const content = extractTextContent(rawContent)

    // Skip empty messages and system messages
    if (!content || !content.trim()) continue

    const filesModified = isAssistant ? extractFilesFromContent(rawContent) : undefined

    cleaned.push({
      role: isAssistant ? 'assistant' : 'user',
      content: content.trim(),
      filesModified: filesModified?.length ? filesModified : undefined,
      timestamp: m.timestamp
    })
  }

  return cleaned
}

/**
 * Extract first user message for preview
 */
function extractFirstUserMessage(messages: MessageEntry[]): string | null {
  for (const m of messages) {
    const isUser = m.message?.role === 'user' || m.type === 'human' || m.type === 'user' || m.role === 'user'
    if (!isUser) continue

    const rawContent = m.message?.content || m.content
    const content = extractTextContent(rawContent)

    if (content && content.trim()) {
      // Truncate to ~100 chars
      const text = content.trim()
      if (text.length <= 100) return text
      return text.substring(0, 97) + '...'
    }
  }

  return null
}

// GET - Get session by short code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('short_code', code)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get linked commits
    const { data: commitLinks } = await supabase
      .from('session_commits')
      .select('commits(*)')
      .eq('session_id', data.id)

    const commits = commitLinks?.map((link: { commits: unknown }) => link.commits) || []

    // Process messages
    const rawMessages = data.messages || []
    const cleanedMessages = cleanMessages(rawMessages)
    const firstUserMessage = data.first_user_message || extractFirstUserMessage(rawMessages)

    return NextResponse.json({
      id: data.id,
      shortCode: data.short_code,
      projectName: data.project_name,
      uploadedAt: data.created_at,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      messageCount: data.message_count,
      messages: rawMessages,
      cleanMessages: cleanedMessages,
      filesModified: data.files_modified,
      repos: data.repos || [],
      firstUserMessage,
      commits
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}
