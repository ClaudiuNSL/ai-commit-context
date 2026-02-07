import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Temporary debug endpoint - DELETE after debugging
export async function GET() {
  const config = {
    github_client_id_set: !!process.env.GITHUB_CLIENT_ID,
    github_client_id_prefix: process.env.GITHUB_CLIENT_ID?.substring(0, 10) || 'NOT SET',
    github_client_secret_set: !!process.env.GITHUB_CLIENT_SECRET,
    github_client_secret_suffix: process.env.GITHUB_CLIENT_SECRET?.slice(-6) || 'NOT SET',
    supabase_url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    app_url: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
  }

  // Test Supabase connection and try a simple query
  let dbTest = 'not tested'
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('device_codes')
      .select('code, status')
      .limit(3)

    if (error) {
      dbTest = `ERROR: ${error.message}`
    } else {
      dbTest = `OK - found ${data?.length || 0} codes: ${JSON.stringify(data)}`
    }
  } catch (e) {
    dbTest = `EXCEPTION: ${e instanceof Error ? e.message : 'unknown'}`
  }

  return NextResponse.json({
    ...config,
    db_test: dbTest,
    timestamp: new Date().toISOString()
  })
}
