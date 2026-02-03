import { NextRequest, NextResponse } from 'next/server'

// Billing portal temporarily disabled for launch
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Billing portal coming soon!' },
    { status: 503 }
  )
}
