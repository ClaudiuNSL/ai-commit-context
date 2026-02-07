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

// Hash the API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
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
      `${baseUrl}/auth/device/error?error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/auth/device/error?error=${encodeURIComponent('Missing authorization code')}`
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
        `${baseUrl}/auth/device/error?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
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
        `${baseUrl}/auth/device/error?error=${encodeURIComponent('Failed to fetch GitHub user info')}`
      )
    }

    const githubUser: GitHubUser = await userResponse.json()

    const supabase = getSupabaseAdmin()

    // Create or update user in profiles table
    // Use GitHub user ID as the unique identifier
    const userId = `github_${githubUser.id}`

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        github_id: githubUser.id,
        github_username: githubUser.login,
        email: githubUser.email,
        name: githubUser.name,
        avatar_url: githubUser.avatar_url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      return NextResponse.redirect(
        `${baseUrl}/auth/device/error?error=${encodeURIComponent('Failed to create user profile')}`
      )
    }

    // Generate API key for CLI usage
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    const { error: keyError } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key_hash: keyHash,
        name: 'CLI Device Auth'
      })

    if (keyError) {
      console.error('API key creation error:', keyError)
      return NextResponse.redirect(
        `${baseUrl}/auth/device/error?error=${encodeURIComponent('Failed to generate API key')}`
      )
    }

    // If state contains a device code, link the API key to it
    if (state) {
      const { error: updateError } = await supabase
        .from('device_codes')
        .update({
          status: 'authorized',
          user_id: userId,
          api_key: apiKey, // Store temporarily for polling
          username: githubUser.login,
          claimed_at: new Date().toISOString()
        })
        .eq('code', state)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      if (updateError) {
        console.error('Device code update error:', updateError)
        // Don't fail the flow, just log the error
      }
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/auth/device/success?username=${encodeURIComponent(githubUser.login)}`
    )
  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      `${baseUrl}/auth/device/error?error=${encodeURIComponent(message)}`
    )
  }
}
