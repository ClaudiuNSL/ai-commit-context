import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'
import { z } from 'zod'

const callbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  device_code: z.string().optional()
})

// Generate a random API key
function generateApiKey(): string {
  return 'acc_' + crypto.randomBytes(24).toString('hex')
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const result = callbackQuerySchema.safeParse({
    code: searchParams.get('code'),
    device_code: searchParams.get('device_code') ?? undefined
  })

  if (!result.success) {
    return NextResponse.redirect(`${origin}/auth/cli?error=${encodeURIComponent('Missing authorization code')}`)
  }

  const { code, device_code: deviceCode } = result.data

  try {
    // Exchange the code for a session
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code)

    if (authError || !authData.user) {
      console.error('Auth exchange error:', authError)
      return NextResponse.redirect(`${origin}/auth/cli?error=${encodeURIComponent('Authentication failed')}`)
    }

    const user = authData.user

    // If we have a device code, update it with the user info and API key
    if (deviceCode) {
      const supabaseAdmin = getSupabaseAdmin()
      const apiKey = generateApiKey()

      // Get GitHub username from user metadata
      const username = user.user_metadata?.user_name ||
                       user.user_metadata?.preferred_username ||
                       user.email?.split('@')[0] ||
                       'user'

      const { error: updateError } = await supabaseAdmin
        .from('device_codes')
        .update({
          user_id: user.id,
          api_key: apiKey,
          status: 'authorized'
        })
        .eq('code', deviceCode)
        .eq('status', 'pending')

      if (updateError) {
        console.error('Failed to update device code:', updateError)
        return NextResponse.redirect(`${origin}/auth/cli?error=${encodeURIComponent('Failed to complete device authorization')}`)
      }

      // Also store the username in the device codes for the poll endpoint
      await supabaseAdmin
        .from('device_codes')
        .update({ username })
        .eq('code', deviceCode)
    }

    // Redirect to success page
    return NextResponse.redirect(`${origin}/auth/cli?success=true`)
  } catch (error) {
    console.error('Callback error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(`${origin}/auth/cli?error=${encodeURIComponent(message)}`)
  }
}
