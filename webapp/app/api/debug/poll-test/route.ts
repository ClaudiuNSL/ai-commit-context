import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Debug version of poll to see raw data
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Provide ?code=XXXXX' })
  }

  const supabase = getSupabaseAdmin()

  // Exact same query as poll endpoint
  const { data: rows, error } = await supabase
    .from('device_codes')
    .select('status, user_id, api_key, username, expires_at')
    .eq('code', code)

  // Also get full row for comparison
  const { data: fullRow } = await supabase
    .from('device_codes')
    .select('*')
    .eq('code', code)

  return NextResponse.json({
    code,
    pollQuery: {
      rows,
      error: error?.message,
      firstRow: rows?.[0]
    },
    fullRow: fullRow?.[0],
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)
  })
}
