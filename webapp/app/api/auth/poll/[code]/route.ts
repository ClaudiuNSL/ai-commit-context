import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

interface PollParams {
  params: Promise<{
    code: string
  }>
}

// GET - Poll device code status
export async function GET(
  request: NextRequest,
  { params }: PollParams
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { error: 'Missing device code' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('device_codes')
      .select('status, user_id, api_key, username, expires_at')
      .eq('code', code)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Invalid device code' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Clean up expired code
      await supabase
        .from('device_codes')
        .delete()
        .eq('code', code)

      return NextResponse.json(
        { error: 'expired' },
        { status: 410 }
      )
    }

    // Check status
    if (data.status === 'authorized' && data.api_key) {
      // Return the API key and clean up the device code
      const response = {
        apiKey: data.api_key,
        userId: data.user_id,
        username: data.username
      }

      // Clear the api_key from the device code for security
      // and mark as consumed
      await supabase
        .from('device_codes')
        .update({
          api_key: null,
          status: 'consumed'
        })
        .eq('code', code)

      return NextResponse.json(response)
    }

    if (data.status === 'consumed') {
      return NextResponse.json(
        { error: 'Device code already used' },
        { status: 410 }
      )
    }

    // Still pending
    return NextResponse.json({ status: 'pending' })
  } catch (error) {
    console.error('Poll error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to poll device code', details: message },
      { status: 500 }
    )
  }
}
