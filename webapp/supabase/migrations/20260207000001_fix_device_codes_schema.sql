-- Migration: Fix device_codes table schema and add profiles table
-- Date: 2026-02-07

-- Create profiles table for GitHub-authenticated users
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                    -- Format: github_<github_user_id>
  github_id BIGINT UNIQUE,                -- GitHub numeric user ID
  github_username TEXT,                   -- GitHub login
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups by github_id
CREATE INDEX IF NOT EXISTS idx_profiles_github_id ON profiles(github_id);

-- Add comments
COMMENT ON TABLE profiles IS 'User profiles from GitHub OAuth';
COMMENT ON COLUMN profiles.id IS 'Custom ID in format github_<numeric_id>';

-- Drop the foreign key constraint since we use custom user IDs (github_123)
-- First check if the constraint exists and drop it
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
ALTER TABLE device_codes ALTER COLUMN user_id TYPE TEXT;

-- Add username column for storing GitHub username
ALTER TABLE device_codes ADD COLUMN IF NOT EXISTS username TEXT;

-- Add claimed_at column for tracking when the code was claimed
ALTER TABLE device_codes ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Update status check constraint to include 'consumed' status
ALTER TABLE device_codes DROP CONSTRAINT IF EXISTS device_codes_status_check;
ALTER TABLE device_codes ADD CONSTRAINT device_codes_status_check
  CHECK (status IN ('pending', 'authorized', 'consumed', 'expired'));

-- Add comments
COMMENT ON COLUMN device_codes.username IS 'GitHub username of authenticated user';
COMMENT ON COLUMN device_codes.claimed_at IS 'Timestamp when OAuth was completed';

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
ALTER TABLE api_keys ALTER COLUMN user_id DROP NOT NULL;

-- Add reference to profiles table
-- Note: Not using foreign key to avoid migration order issues
COMMENT ON COLUMN api_keys.user_id IS 'References profiles.id (format: github_xxx)';
