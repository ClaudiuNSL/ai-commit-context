import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

// Simulates exactly what the OAuth callback does
// Call with ?state=DEVICE_CODE to test
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')

  if (!state) {
    return NextResponse.json({ error: 'Provide ?state=DEVICE_CODE' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const userId = 'github_test_123'
  const apiKey = `acc_${crypto.randomBytes(24).toString('base64url')}`
  const username = 'SimulatedUser'

  const steps: any[] = []

  // Step 1: Check if code exists (same as real callback)
  const { data: existingCode, error: checkError } = await supabase
    .from('device_codes')
    .select('code, status, expires_at')
    .eq('code', state)

  steps.push({
    step: 1,
    action: 'Check existing code',
    query: `.select().eq('code', '${state}')`,
    result: existingCode,
    error: checkError?.message
  })

  if (!existingCode || existingCode.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Device code not found',
      state,
      steps
    })
  }

  // Step 2: Update (same as real callback)
  const { data: updateData, error: updateError } = await supabase
    .from('device_codes')
    .update({
      status: 'authorized',
      user_id: userId,
      api_key: apiKey,
      username: username,
      claimed_at: new Date().toISOString()
    })
    .eq('code', state)
    .select()

  steps.push({
    step: 2,
    action: 'Update device code',
    query: `.update({status: 'authorized', ...}).eq('code', '${state}')`,
    result: updateData,
    error: updateError?.message
  })

  // Step 3: Verify
  const { data: afterUpdate } = await supabase
    .from('device_codes')
    .select('*')
    .eq('code', state)

  steps.push({
    step: 3,
    action: 'Verify update',
    result: afterUpdate
  })

  // What would the real callback do?
  const wouldRedirectToSuccess = !updateError && updateData && updateData.length > 0
  const wouldRedirectToError = updateError || !updateData || updateData.length === 0

  return NextResponse.json({
    success: wouldRedirectToSuccess,
    state,
    wouldRedirectTo: wouldRedirectToSuccess ? 'SUCCESS' : 'ERROR',
    steps,
    finalStatus: afterUpdate?.[0]?.status
  })
}
