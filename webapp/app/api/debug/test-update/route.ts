import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Temporary debug endpoint - DELETE after debugging
// Tests if UPDATE works on device_codes table
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Provide ?code=XXXXX' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // First check if code exists
  const { data: existing, error: selectError } = await supabase
    .from('device_codes')
    .select('*')
    .eq('code', code)

  if (selectError) {
    return NextResponse.json({
      step: 'select',
      error: selectError.message,
      details: selectError
    }, { status: 500 })
  }

  if (!existing || existing.length === 0) {
    return NextResponse.json({
      step: 'select',
      error: 'Code not found',
      code
    }, { status: 404 })
  }

  // Try to update it
  const { data: updated, error: updateError } = await supabase
    .from('device_codes')
    .update({
      status: 'authorized',
      user_id: 'test_user_123',
      api_key: 'acc_test_api_key_12345',
      username: 'TestUser',
      claimed_at: new Date().toISOString()
    })
    .eq('code', code)
    .select()

  if (updateError) {
    return NextResponse.json({
      step: 'update',
      error: updateError.message,
      details: updateError,
      existing: existing[0]
    }, { status: 500 })
  }

  // Check if update actually worked
  const { data: afterUpdate } = await supabase
    .from('device_codes')
    .select('*')
    .eq('code', code)

  return NextResponse.json({
    success: true,
    before: existing[0],
    updateResult: updated,
    after: afterUpdate?.[0],
    updateWorked: afterUpdate?.[0]?.status === 'authorized'
  })
}
