import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// POST - Link commit to session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const { sha, repoUrl, message } = await request.json()

  if (!sha) {
    return NextResponse.json(
      { error: 'Missing required field: sha' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseAdmin()

    // Get session
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('short_code', code)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Insert or get commit
    const { data: commit } = await supabase
      .from('commits')
      .upsert(
        {
          sha,
          repo_url: repoUrl || '',
          message: message || ''
        },
        { onConflict: 'sha,repo_url' }
      )
      .select()
      .single()

    if (commit) {
      // Link session to commit
      await supabase.from('session_commits').upsert({
        session_id: session.id,
        commit_id: commit.id
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error linking commit:', error)
    return NextResponse.json({ error: 'Failed to link commit' }, { status: 500 })
  }
}
