import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Debug endpoint to see commits
export async function GET() {
  const supabase = getSupabaseAdmin()

  const { data: commits, error: commitsError } = await supabase
    .from('commits')
    .select('*')
    .limit(10)

  const { data: sessionCommits, error: scError } = await supabase
    .from('session_commits')
    .select('*')
    .limit(10)

  return NextResponse.json({
    commits: { data: commits, error: commitsError?.message },
    sessionCommits: { data: sessionCommits, error: scError?.message }
  })
}
