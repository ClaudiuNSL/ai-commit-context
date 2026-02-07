import { NextRequest, NextResponse } from 'next/server'

// GET - Generate GitHub OAuth URL
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  // This is the user_code (short code shown to user)
  const userCode = searchParams.get('device_code') || ''

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-commit-context.vercel.app'
  const redirectUri = `${baseUrl}/api/auth/github`

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
  githubAuthUrl.searchParams.set('client_id', clientId)
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri)
  githubAuthUrl.searchParams.set('scope', 'read:user user:email')
  githubAuthUrl.searchParams.set('state', userCode)

  return NextResponse.json({ url: githubAuthUrl.toString() })
}
