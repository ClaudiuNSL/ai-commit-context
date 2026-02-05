import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET - Validate a device code
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Code parameter is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('device_codes')
      .select('code, status, expires_at, user_id, api_key')
      .eq('code', code)
      .single()

    if (error || !data) {
      return NextResponse.json({
        exists: false,
        expired: false,
        completed: false
      })
    }

    const isExpired = new Date(data.expires_at) < new Date()
    const isCompleted = data.status === 'authorized' && data.api_key !== null

    return NextResponse.json({
      exists: true,
      expired: isExpired,
      completed: isCompleted
    })
  } catch (error) {
    console.error('Device code validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate device code' },
      { status: 500 }
    )
  }
}
