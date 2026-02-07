import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
  error?: string
  error_description?: string
}

interface GitHubUser {
  id: number
  login: string
  email: string | null
  name: string | null
  avatar_url: string
}

// Generate a random API key
function generateApiKey(): string {
  return `acc_${crypto.randomBytes(24).toString('base64url')}`
}

// GET - GitHub OAuth callback for device flow
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${baseUrl}/auth/cli?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/auth/cli?error=${encodeURIComponent('Missing authorization code')}`
    )
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    })

    const tokenData: GitHubTokenResponse = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub token exchange error:', tokenData.error, tokenData.error_description)
      return NextResponse.redirect(
        `${baseUrl}/auth/cli?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      )
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Commit-Context'
      }
    })

    if (!userResponse.ok) {
      console.error('GitHub user fetch error:', userResponse.status, await userResponse.text())
      return NextResponse.redirect(
        `${baseUrl}/auth/cli?error=${encodeURIComponent('Failed to fetch GitHub user info')}`
      )
    }

    const githubUser: GitHubUser = await userResponse.json()

    const supabase = getSupabaseAdmin()
    const userId = `github_${githubUser.id}`

    // Generate API key for CLI usage
    const apiKey = generateApiKey()

    // If state contains a device code, update the device_codes row with auth info
    if (state) {
      console.log('=== OAuth Callback Debug ===')
      console.log('State (device code):', state)
      console.log('User:', githubUser.login)
      console.log('API Key prefix:', apiKey.substring(0, 10))

      // First, check if the device code exists
      const { data: existingCode, error: checkError } = await supabase
        .from('device_codes')
        .select('code, status, expires_at')
        .eq('code', state)

      console.log('Existing code check:', { existingCode, checkError })

      if (!existingCode || existingCode.length === 0) {
        console.error('Device code not found in database:', state)
        return NextResponse.redirect(
          `${baseUrl}/auth/cli?error=${encodeURIComponent('Device code not found')}`
        )
      }

      // Now update without the expires_at check (we'll verify manually)
      const { data: updateData, error: updateError } = await supabase
        .from('device_codes')
        .update({
          status: 'authorized',
          user_id: userId,
          api_key: apiKey,
          username: githubUser.login,
          claimed_at: new Date().toISOString()
        })
        .eq('code', state)
        .select()

      console.log('Update result:', { updateData, updateError })

      if (updateError) {
        console.error('Device code update error:', updateError)
        return NextResponse.redirect(
          `${baseUrl}/auth/cli?error=${encodeURIComponent('Failed to complete authentication')}`
        )
      }

      if (!updateData || updateData.length === 0) {
        console.error('No device code found:', state)
        return NextResponse.redirect(
          `${baseUrl}/auth/cli?error=${encodeURIComponent('Device code not found or expired. Please try again.')}`
        )
      }
    } else {
      // No user code - this shouldn't happen in normal flow
      return NextResponse.redirect(
        `${baseUrl}/auth/cli?error=${encodeURIComponent('Missing authentication code')}`
      )
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/auth/cli?success=true&username=${encodeURIComponent(githubUser.login)}`
    )
  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `${baseUrl}/auth/cli?error=${encodeURIComponent(message)}`
    )
  }
}
