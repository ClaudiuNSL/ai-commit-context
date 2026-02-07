import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { linkCommitSchema, sessionCodeParamSchema, parseBody } from '@/lib/validations'

// POST - Link commit to session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rawParams = await params
  const parsedParams = parseBody(sessionCodeParamSchema, rawParams)

  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid session code' }, { status: 400 })
  }

  const { code } = parsedParams.data
  const body = await request.json()
  const parsed = parseBody(linkCommitSchema, body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error },
      { status: 400 }
    )
  }

  const { sha, repoUrl, repoOwner, repoName, message } = parsed.data

  // Build repo URL from owner/name if not provided directly
  const finalRepoUrl = repoUrl || (repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}` : '')

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
    const { data: commit, error: commitError } = await supabase
      .from('commits')
      .upsert(
        {
          sha,
          repo_url: finalRepoUrl,
          repo_owner: repoOwner || '',
          repo_name: repoName || '',
          message: message || ''
        },
        { onConflict: 'sha,repo_url' }
      )
      .select()
      .single()

    if (commitError) {
      console.error('Error upserting commit:', commitError)
    }

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
