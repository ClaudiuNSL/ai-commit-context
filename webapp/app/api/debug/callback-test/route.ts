import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

// This is an EXACT copy of /api/auth/github but returns JSON instead of redirect
// So we can see what's happening

function generateApiKey(): string {
  return `acc_${crypto.randomBytes(24).toString('base64url')}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code') // GitHub auth code (fake for testing)
  const state = searchParams.get('state') // Our device code

  const debug: any = {
    received: { code: code?.substring(0, 10), state },
    steps: []
  }

  if (!state) {
    return NextResponse.json({ error: 'Missing state parameter', debug })
  }

  // Simulate having a GitHub user (skip actual GitHub API call)
  const githubUser = {
    id: 999999,
    login: 'DebugTestUser'
  }

  const supabase = getSupabaseAdmin()
  const userId = `github_${githubUser.id}`
  const apiKey = generateApiKey()

  debug.steps.push({ step: 'setup', userId, apiKeyPrefix: apiKey.substring(0, 12) })

  // Check if device code exists
  const { data: existingCode, error: checkError } = await supabase
    .from('device_codes')
    .select('code, status, expires_at')
    .eq('code', state)

  debug.steps.push({
    step: 'check_existing',
    query: `.select().eq('code', '${state}')`,
    result: existingCode,
    error: checkError?.message
  })

  if (!existingCode || existingCode.length === 0) {
    return NextResponse.json({
      wouldRedirectTo: 'ERROR - code not found',
      debug
    })
  }

  // Update
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

  debug.steps.push({
    step: 'update',
    query: `.update({...}).eq('code', '${state}')`,
    result: updateData,
    error: updateError?.message
  })

  if (updateError) {
    return NextResponse.json({
      wouldRedirectTo: 'ERROR - update failed',
      debug
    })
  }

  if (!updateData || updateData.length === 0) {
    return NextResponse.json({
      wouldRedirectTo: 'ERROR - no rows updated',
      debug
    })
  }

  // Verify
  const { data: afterUpdate } = await supabase
    .from('device_codes')
    .select('*')
    .eq('code', state)

  debug.steps.push({
    step: 'verify',
    result: afterUpdate
  })

  return NextResponse.json({
    wouldRedirectTo: 'SUCCESS',
    finalStatus: afterUpdate?.[0]?.status,
    debug
  })
}
