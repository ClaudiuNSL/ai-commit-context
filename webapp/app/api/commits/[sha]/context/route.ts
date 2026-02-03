import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET - Get context for a commit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sha: string }> }
) {
  const { sha } = await params

  try {
    const supabase = getSupabaseAdmin()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Find commits matching the SHA (exact or prefix)
    const { data: commits } = await supabase
      .from('commits')
      .select('id')
      .or(`sha.eq.${sha},sha.like.${sha}%`)

    if (!commits || commits.length === 0) {
      return NextResponse.json({ commitSha: sha, sessions: [] })
    }

    const commitIds = commits.map(c => c.id)

    // Get linked sessions
    const { data: links } = await supabase
      .from('session_commits')
      .select('sessions(*)')
      .in('commit_id', commitIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = links?.map((link: any) => ({
      id: link.sessions.id,
      shortCode: link.sessions.short_code,
      url: `${baseUrl}/s/${link.sessions.short_code}`,
      projectName: link.sessions.project_name,
      messageCount: link.sessions.message_count,
      startedAt: link.sessions.started_at
    })) || []

    return NextResponse.json({ commitSha: sha, sessions })
  } catch (error) {
    console.error('Error fetching commit context:', error)
    return NextResponse.json({ error: 'Failed to fetch commit context' }, { status: 500 })
  }
}
