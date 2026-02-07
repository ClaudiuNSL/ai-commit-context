-- Migration: Fix device_codes table schema
-- Date: 2026-02-07

-- Add missing columns to profiles table if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_id BIGINT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster lookups by github_id
CREATE INDEX IF NOT EXISTS idx_profiles_github_id ON profiles(github_id);

-- Drop policy that depends on user_id column
DROP POLICY IF EXISTS "Users can view own device codes" ON device_codes;

-- Drop the foreign key constraint on device_codes since we use custom user IDs (github_123)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'device_codes_user_id_fkey'
    AND table_name = 'device_codes'
  ) THEN
    ALTER TABLE device_codes DROP CONSTRAINT device_codes_user_id_fkey;
  END IF;
END $$;

-- Change user_id column type from UUID to TEXT to support github_xxx format
ALTER TABLE device_codes ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Add username column for storing GitHub username
ALTER TABLE device_codes ADD COLUMN IF NOT EXISTS username TEXT;

-- Add claimed_at column for tracking when the code was claimed
ALTER TABLE device_codes ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Update status check constraint to include 'consumed' status
ALTER TABLE device_codes DROP CONSTRAINT IF EXISTS device_codes_status_check;
ALTER TABLE device_codes ADD CONSTRAINT device_codes_status_check
  CHECK (status IN ('pending', 'authorized', 'consumed', 'expired'));

-- Drop policies that depend on api_keys.user_id column
DROP POLICY IF EXISTS "Users can view own keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete own keys" ON api_keys;

-- Fix api_keys table to use TEXT user_id instead of UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'api_keys_user_id_fkey'
    AND table_name = 'api_keys'
  ) THEN
    ALTER TABLE api_keys DROP CONSTRAINT api_keys_user_id_fkey;
  END IF;
END $$;

ALTER TABLE api_keys ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

DO $$
BEGIN
  ALTER TABLE api_keys ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;
