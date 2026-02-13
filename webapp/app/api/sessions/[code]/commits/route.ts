import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { linkCommitSchema, sessionCodeParamSchema, parseBody } from '@/lib/validations'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

// POST - Link commit to session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  // Rate limiting
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`commit-link:${clientIp}`, RATE_LIMITS.commitLink)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

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

    // First try to find existing commit
    const { data: existingCommit } = await supabase
      .from('commits')
      .select('id')
      .eq('sha', sha)
      .maybeSingle()

    let commitId: string

    if (existingCommit) {
      commitId = existingCommit.id
    } else {
      // Insert new commit
      const { data: newCommit, error: insertError } = await supabase
        .from('commits')
        .insert({
          sha,
          repo_url: finalRepoUrl,
          repo_owner: repoOwner || '',
          repo_name: repoName || '',
          message: message || ''
        })
        .select('id')
        .single()

      if (insertError || !newCommit) {
        console.error('Error inserting commit:', insertError)
        return NextResponse.json({
          error: 'Failed to create commit',
          details: insertError?.message
        }, { status: 500 })
      }

      commitId = newCommit.id
    }

    // Link session to commit - check if already linked first
    const { data: existingLink } = await supabase
      .from('session_commits')
      .select('id')
      .eq('session_id', session.id)
      .eq('commit_id', commitId)
      .maybeSingle()

    if (!existingLink) {
      const { error: linkError } = await supabase
        .from('session_commits')
        .insert({
          session_id: session.id,
          commit_id: commitId
        })

      if (linkError) {
        console.error('Error linking commit:', linkError)
        return NextResponse.json({
          error: 'Failed to link commit',
          details: linkError?.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      commitId
    })
  } catch (error) {
    console.error('Error linking commit:', error)
    return NextResponse.json({ error: 'Failed to link commit' }, { status: 500 })
  }
}
