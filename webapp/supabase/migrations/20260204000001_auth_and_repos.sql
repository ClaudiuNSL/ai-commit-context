-- Migration: Add device codes table and repos column for commit-context plugin
-- Date: 2026-02-04

-- Create device_codes table for CLI authentication flow
CREATE TABLE IF NOT EXISTS device_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_device_codes_expires_at ON device_codes(expires_at);

-- Add repos column to sessions table (stores per-repo file tracking)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS repos JSONB;

-- Add first_user_message column for preview display
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS first_user_message TEXT;

-- Enable RLS on device_codes (service role only for API operations)
ALTER TABLE device_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view their own device codes
CREATE POLICY "Users can view own device codes" ON device_codes
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Service role can manage all device codes (for API operations)
-- This is handled by using service role key in API routes

-- Add comments for documentation
COMMENT ON TABLE device_codes IS 'Stores device codes for CLI OAuth flow';
COMMENT ON COLUMN device_codes.code IS '8-character device code shown to user';
COMMENT ON COLUMN device_codes.user_id IS 'Linked user after OAuth completion';
COMMENT ON COLUMN device_codes.api_key IS 'Generated API key after OAuth completion';
COMMENT ON COLUMN device_codes.expires_at IS 'Code expiration (10 minutes from creation)';

COMMENT ON COLUMN sessions.repos IS 'JSON array of repo info with files modified';
COMMENT ON COLUMN sessions.first_user_message IS 'First user message, truncated for preview';
