-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
DROP POLICY IF EXISTS "Anyone can view unlisted sessions" ON sessions;

-- Add RLS policy for sessions table to allow users to read their own sessions
CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Allow anyone to view unlisted/public sessions
CREATE POLICY "Anyone can view unlisted sessions" ON sessions
  FOR SELECT USING (privacy = 'unlisted' OR privacy = 'public');
