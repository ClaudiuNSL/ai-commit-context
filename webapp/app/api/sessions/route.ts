import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyApiKey } from '@/lib/api-auth'

// POST - Upload session (from CLI)
export async function POST(request: NextRequest) {
  try {
    // Check for API key authentication
    const authHeader = request.headers.get('Authorization')
    const userId = await verifyApiKey(authHeader)

    const { sessionId, projectName, startedAt, endedAt, messages, filesModified } =
      await request.json()

    if (!sessionId || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, messages' },
        { status: 400 }
      )
    }

    const shortCode = nanoid(8)
    const supabase = getSupabaseAdmin()

    // Ensure profile exists if we have a user_id
    if (userId) {
      await supabase
        .from('profiles')
        .upsert({ id: userId }, { onConflict: 'id' })
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
