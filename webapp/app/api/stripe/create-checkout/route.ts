import { NextRequest, NextResponse } from 'next/server'

// Payments temporarily disabled for launch
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Payments coming soon! All features are currently free.' },
    { status: 503 }
  )
}
