import { getSupabaseAdmin } from './supabase-admin'
import crypto from 'crypto'

// Hash the API key for lookup
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Verify API key and return user_id
export async function verifyApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Check if it's an API key (starts with acc_)
  if (!apiKey.startsWith('acc_')) {
    return null
  }

  const keyHash = hashApiKey(apiKey)
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return null
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return data.user_id
}
