import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sessionCodeParamSchema, parseBody } from '@/lib/validations'

interface ContentBlock {
  type: string
  text?: string
}

interface MessageEntry {
  type?: string
  role?: string
  message?: {
    role?: string
    content?: string | ContentBlock[]
  }
  content?: string | ContentBlock[]
}

/**
 * Extract text content from message content
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
 * Extract first user message for preview
 */
function extractFirstUserMessage(messages: MessageEntry[]): string | null {
  for (const m of messages) {
    const isUser = m.message?.role === 'user' || m.type === 'human' || m.type === 'user' || m.role === 'user'
    if (!isUser) continue

    const rawContent = m.message?.content || m.content
    const content = extractTextContent(rawContent)

    if (content && content.trim()) {
      const text = content.trim()
      if (text.length <= 100) return text
      return text.substring(0, 97) + '...'
    }
  }

  return null
}

/**
 * Count files modified across all messages
 */
function countFilesModified(filesModified: string[] | null, repos: unknown[] | null): number {
  if (filesModified && filesModified.length > 0) {
    return filesModified.length
  }

  if (repos && Array.isArray(repos)) {
    let count = 0
    for (const repo of repos) {
      if (typeof repo === 'object' && repo !== null && 'filesModified' in repo) {
        const repoFiles = (repo as { filesModified?: string[] }).filesModified
        if (Array.isArray(repoFiles)) {
          count += repoFiles.length
        }
      }
    }
    return count
  }

  return 0
}

// GET - Get session preview for GitHub Action
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rawParams = await params
  const parsed = parseBody(sessionCodeParamSchema, rawParams)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid session code' }, { status: 400 })
  }

  const { code } = parsed.data

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('sessions')
      .select('short_code, messages, files_modified, repos, first_user_message')
      .eq('short_code', code)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const messages = data.messages || []
    const firstUserMessage = data.first_user_message || extractFirstUserMessage(messages)
    const fileCount = countFilesModified(data.files_modified, data.repos)
    const repoCount = Array.isArray(data.repos) ? data.repos.length : 0

    // Build viewer URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-commit-context.vercel.app'
    const url = `${baseUrl}/s/${data.short_code}`

    return NextResponse.json({
      shortCode: data.short_code,
      firstUserMessage,
      fileCount,
      repoCount,
      url
    })
  } catch (error) {
    console.error('Error fetching session preview:', error)
    return NextResponse.json({ error: 'Failed to fetch session preview' }, { status: 500 })
  }
}
