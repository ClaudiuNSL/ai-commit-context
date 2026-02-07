import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET - Poll for device code authorization status
export async function GET(request: NextRequest) {
  const deviceCode = request.nextUrl.searchParams.get('device_code')

  if (!deviceCode) {
    return NextResponse.json(
      { error: 'device_code parameter is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('device_codes')
      .select('code, status, expires_at, user_id, api_key, username')
      .eq('code', deviceCode)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Device code not found' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({
        status: 'expired',
      })
    }

    // Check if authorized
    if (data.status === 'authorized' && data.api_key) {
      return NextResponse.json({
        status: 'authorized',
        apiKey: data.api_key,
        username: data.username,
        userId: data.user_id,
      })
    }

    // Still pending
    return NextResponse.json({
      status: 'pending',
    })
  } catch (error) {
    console.error('Device code poll error:', error)
    return NextResponse.json(
      { error: 'Failed to poll device code' },
      { status: 500 }
    )
  }
}
