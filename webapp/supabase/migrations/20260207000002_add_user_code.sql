-- Migration: Add user_code column to device_codes
-- Date: 2026-02-07

-- Add user_code column for the short code displayed to users
ALTER TABLE device_codes ADD COLUMN IF NOT EXISTS user_code TEXT;

-- Create index for looking up by user_code
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code ON device_codes(user_code);
