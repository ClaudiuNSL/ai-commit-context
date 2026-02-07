import { NextRequest, NextResponse } from 'next/server'

// Debug endpoint to see what parameters OAuth callback receives
// Simulates what /api/auth/github receives
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  return NextResponse.json({
    message: 'This shows what parameters the OAuth callback would receive',
    received_params: {
      code: searchParams.get('code'),
      state: searchParams.get('state'),
      error: searchParams.get('error'),
      error_description: searchParams.get('error_description'),
    },
    all_params: Object.fromEntries(searchParams.entries()),
    url: request.url,
    timestamp: new Date().toISOString()
  })
}
