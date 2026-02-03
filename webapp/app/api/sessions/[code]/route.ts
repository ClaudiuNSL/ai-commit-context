import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

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

    return NextResponse.json({
      id: data.id,
      shortCode: data.short_code,
      projectName: data.project_name,
      uploadedAt: data.created_at,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      messageCount: data.message_count,
      messages: data.messages,
      filesModified: data.files_modified,
      commits
    })
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}
