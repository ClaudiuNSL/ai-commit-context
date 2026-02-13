import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyApiKey } from '@/lib/api-auth'
import { uploadSessionSchema, parseBody } from '@/lib/validations'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

// POST - Upload session (from CLI)
export async function POST(request: NextRequest) {
  // Rate limiting
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`session-upload:${clientIp}`, RATE_LIMITS.sessionUpload)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.reset)
        }
      }
    )
  }

  try {
    // Check for API key authentication
    const authHeader = request.headers.get('Authorization')
    const userId = await verifyApiKey(authHeader)

    const body = await request.json()
    const parsed = parseBody(uploadSessionSchema, body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error },
        { status: 400 }
      )
    }

    const { sessionId, projectName, startedAt, endedAt, messages, filesModified, repos } = parsed.data

    const shortCode = nanoid(8)
    const supabase = getSupabaseAdmin()

    // Ensure profile exists if we have a user_id
    if (userId) {
      await supabase
        .from('profiles')
        .upsert({ id: userId }, { onConflict: 'id' })
    }

    // Extract first user message for preview
    let firstUserMessage: string | null = null
    for (const m of messages) {
      if (m.role === 'user' && m.content) {
        const text = typeof m.content === 'string' ? m.content : ''
        if (text.trim()) {
          firstUserMessage = text.length > 100 ? text.substring(0, 97) + '...' : text
          break
        }
      }
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        short_code: shortCode,
        project_name: projectName || 'Unknown Project',
        started_at: startedAt || new Date().toISOString(),
        ended_at: endedAt || null,
        message_count: messages.length,
        messages: messages,
        files_modified: filesModified || [],
        repos: repos || null,
        first_user_message: firstUserMessage,
        privacy: 'unlisted',
        user_id: userId || null
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to upload session', details: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.json({
      success: true,
      id: data.id,
      shortCode: data.short_code,
      url: `${baseUrl}/s/${data.short_code}`
    })
  } catch (error) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to upload session', details: message }, { status: 500 })
  }
}

// GET - List sessions
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    // Try session_summaries view first, fallback to sessions table
    let { data, error } = await supabase
      .from('session_summaries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      // Fallback to sessions table if view doesn't exist
      const result = await supabase
        .from('sessions')
        .select('id, short_code, project_name, message_count, created_at, started_at')
        .order('created_at', { ascending: false })
        .limit(50)

      data = result.data
    }

    return NextResponse.json({
      sessions: data?.map(s => ({
        id: s.id,
        shortCode: s.short_code,
        projectName: s.project_name,
        messageCount: s.message_count,
        uploadedAt: s.created_at,
        startedAt: s.started_at,
        commitCount: s.commit_count
      })) || []
    })
  } catch (error) {
    console.error('Error listing sessions:', error)
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 })
  }
}
