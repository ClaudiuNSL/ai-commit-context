import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'
import { createApiKeySchema, deleteApiKeySchema, parseBody } from '@/lib/validations'

// Generate a random API key
function generateApiKey(): string {
  return `acc_${crypto.randomBytes(24).toString('base64url')}`
}

// Hash the API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(createApiKeySchema, body)
    const name = parsed.success ? parsed.data.name : 'Default'

    // Generate new API key
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)

    // Store hashed key in database
    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('api_keys')
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        name: name || 'Default'
      })

    if (error) {
      console.error('Failed to create API key:', error)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Return the plain key (only shown once)
    return NextResponse.json({
      key: apiKey,
      message: 'Save this key - it will not be shown again'
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - List user's API keys (without the actual key)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('api_keys')
      .select('id, name, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to list API keys:', error)
      return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 })
    }

    return NextResponse.json({ keys: data })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = parseBody(deleteApiKeySchema, body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error }, { status: 400 })
    }

    const { id } = parsed.data

    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('api_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete API key:', error)
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
