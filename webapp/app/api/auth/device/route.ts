import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

// Generate a random 8-character device code
function generateDeviceCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// POST - Generate device code for CLI authentication
export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    const deviceCode = generateDeviceCode()

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('device_codes')
      .insert({
        code: deviceCode,
        expires_at: expiresAt,
        status: 'pending'
      })

    if (error) {
      console.error('Failed to create device code:', error)
      return NextResponse.json(
        { error: 'Failed to create device code', details: error.message },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/auth/cli?code=${deviceCode}`

    return NextResponse.json({
      deviceCode,
      verificationUrl
    })
  } catch (error) {
    console.error('Device code generation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to generate device code', details: message },
      { status: 500 }
    )
  }
}
