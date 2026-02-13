import { NextRequest, NextResponse } from 'next/server'

/**
 * CSRF Protection utilities
 *
 * For API endpoints that accept mutations (POST, PUT, DELETE, PATCH):
 * - CLI requests with API keys are allowed (Authorization header)
 * - Browser requests must have valid Origin header matching app URL
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'https://aicommitcontext.dev',
  'http://localhost:3000',
].filter(Boolean) as string[]

/**
 * Check if the request is from an allowed origin
 */
export function validateOrigin(request: NextRequest): boolean {
  // API key requests bypass CSRF (CLI usage)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return true
  }

  // Check Origin header
  const origin = request.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
    return true
  }

  // Check Referer as fallback
  const referer = request.headers.get('Referer')
  if (referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed))) {
    return true
  }

  // Allow requests without Origin/Referer if they have a valid session cookie
  // (same-origin requests from the browser)
  const hasCookie = request.cookies.has('sb-access-token') ||
                    request.cookies.has('supabase-auth-token')
  if (hasCookie && !origin && !referer) {
    return true
  }

  return false
}

/**
 * CSRF error response
 */
export function csrfErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'CSRF validation failed. Invalid origin.' },
    { status: 403 }
  )
}

/**
 * Validate CSRF for mutation requests
 * Returns null if valid, or an error response if invalid
 */
export function checkCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()

  // Only check mutation methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null
  }

  if (!validateOrigin(request)) {
    return csrfErrorResponse()
  }

  return null
}
