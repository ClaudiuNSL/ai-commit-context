import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const sessionCode = request.nextUrl.searchParams.get('code')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get session first
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, short_code')
    .eq('short_code', sessionCode)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found', sessionError })
  }

  // Get all session_commits links
  const { data: links, error: linksError } = await supabase
    .from('session_commits')
    .select('*')
    .eq('session_id', session.id)

  // Get all commits
  const { data: allCommits, error: commitsError } = await supabase
    .from('commits')
    .select('*')
    .limit(10)

  // Get all session_commits
  const { data: allLinks, error: allLinksError } = await supabase
    .from('session_commits')
    .select('*')
    .limit(10)

  return NextResponse.json({
    session,
    linksForSession: links,
    linksError,
    allCommits,
    commitsError,
    allLinks,
    allLinksError
  })
}
