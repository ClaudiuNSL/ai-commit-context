import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sessionCodeParamSchema, parseBody } from '@/lib/validations'

interface PollParams {
  params: Promise<{
    code: string
  }>
}

// GET - Poll device code status
// v2 - with cache disabled
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: PollParams
) {
  try {
    const rawParams = await params
    const parsed = parseBody(sessionCodeParamSchema, rawParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing device code' },
        { status: 400 }
      )
    }

    const { code } = parsed.data

    const supabase = getSupabaseAdmin()

    // Don't use .single() - it causes issues with Supabase
    const { data: rows, error } = await supabase
      .from('device_codes')
      .select('status, user_id, api_key, username, expires_at')
      .eq('code', code)

    const data = rows?.[0]

    if (error || !data) {
      return NextResponse.json(
        { error: 'Invalid device code' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
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
      const response = {
        apiKey: data.api_key,
        userId: data.user_id,
        username: data.username
      }

      // Mark as consumed
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
