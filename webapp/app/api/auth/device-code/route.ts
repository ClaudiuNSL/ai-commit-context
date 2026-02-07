import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'
import { codeQuerySchema, parseQuery } from '@/lib/validations'

function generateDeviceCode(): string {
  return crypto.randomBytes(32).toString('base64url')
}

function generateUserCode(): string {
  // Generate 8-char alphanumeric code (easier to type)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No 0/O/1/I confusion
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code.slice(0, 4) + '-' + code.slice(4)
}

// POST - Create a new device code for CLI authentication
export async function POST(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()

    const deviceCode = generateDeviceCode()
    const userCode = generateUserCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    const { error } = await supabase.from('device_codes').insert({
      code: deviceCode,
      user_code: userCode,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })

    if (error) {
      console.error('Device code creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create device code' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-commit-context.vercel.app'

    return NextResponse.json({
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl}/auth/cli?code=${userCode}`,
      expiresIn: 900, // 15 minutes in seconds
      interval: 5, // Poll every 5 seconds
    })
  } catch (error) {
    console.error('Device code error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Validate a device code (checks both user_code and code columns)
export async function GET(request: NextRequest) {
  const parsed = parseQuery(codeQuerySchema, request.nextUrl.searchParams)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error },
      { status: 400 }
    )
  }

  const codeParam = parsed.data.code

  try {
    const supabase = getSupabaseAdmin()

    // Try user_code first (new format: XXXX-XXXX)
    let { data, error } = await supabase
      .from('device_codes')
      .select('code, user_code, status, expires_at, user_id, api_key')
      .eq('user_code', codeParam)
      .single()

    // If not found, try code column (old format: 12D01A71)
    if (error || !data) {
      const result = await supabase
        .from('device_codes')
        .select('code, user_code, status, expires_at, user_id, api_key')
        .eq('code', codeParam)
        .single()

      data = result.data
      error = result.error
    }

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
