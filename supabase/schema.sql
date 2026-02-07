-- AI Commit Context - Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    github_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- SESSIONS TABLE (Claude Code conversations)
-- ============================================================================
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    short_code TEXT UNIQUE NOT NULL,
    project_name TEXT,
    privacy TEXT DEFAULT 'private' CHECK (privacy IN ('public', 'private', 'unlisted')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    messages JSONB,
    files_modified TEXT[],
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Policies for sessions
CREATE POLICY "Public sessions are viewable by everyone"
    ON public.sessions FOR SELECT
    USING (privacy = 'public' OR privacy = 'unlisted' OR auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON public.sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sessions"
    ON public.sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON public.sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Allow anonymous inserts (for CLI without auth)
CREATE POLICY "Allow anonymous session inserts"
    ON public.sessions FOR INSERT
    WITH CHECK (user_id IS NULL);

-- Allow anonymous selects for unlisted/public
CREATE POLICY "Allow anonymous session selects"
    ON public.sessions FOR SELECT
    USING (privacy IN ('public', 'unlisted'));

-- ============================================================================
-- COMMITS TABLE
-- ============================================================================
CREATE TABLE public.commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sha TEXT NOT NULL,
    repo_owner TEXT,
    repo_name TEXT,
    repo_url TEXT,
    branch TEXT,
    message TEXT,
    author TEXT,
    committed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sha, repo_url)
);

-- Enable RLS
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;

-- Policies for commits
CREATE POLICY "Commits are viewable by everyone"
    ON public.commits FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert commits"
    ON public.commits FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- SESSION_COMMITS (junction table)
-- ============================================================================
CREATE TABLE public.session_commits (
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    commit_id UUID REFERENCES public.commits(id) ON DELETE CASCADE,
    files_matched TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (session_id, commit_id)
);

-- Enable RLS
ALTER TABLE public.session_commits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Session commits are viewable by everyone"
    ON public.session_commits FOR SELECT
    USING (true);

CREATE POLICY "Anyone can link commits"
    ON public.session_commits FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- API_KEYS TABLE (for CLI authentication)
-- ============================================================================
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    name TEXT DEFAULT 'CLI Key',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);

-- Enable RLS (service role bypasses for API operations)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.api_keys IS 'Stores API keys for CLI authentication';
COMMENT ON COLUMN public.api_keys.user_id IS 'User ID in format github_XXXXX';
COMMENT ON COLUMN public.api_keys.key_hash IS 'Hashed API key for verification';

-- ============================================================================
-- DEVICE_CODES TABLE (for CLI OAuth flow)
-- ============================================================================
CREATE TABLE public.device_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT,
    user_code TEXT,
    api_key TEXT,
    username TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'consumed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ
);

CREATE INDEX idx_device_codes_expires_at ON public.device_codes(expires_at);
CREATE INDEX idx_device_codes_status ON public.device_codes(status);

-- Enable RLS (service role bypasses for API operations)
ALTER TABLE public.device_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.device_codes IS 'Stores device codes for CLI OAuth flow';
COMMENT ON COLUMN public.device_codes.code IS '8-character device code shown to user';
COMMENT ON COLUMN public.device_codes.user_id IS 'User ID in format github_XXXXX after OAuth';
COMMENT ON COLUMN public.device_codes.api_key IS 'Generated API key after OAuth completion';
COMMENT ON COLUMN public.device_codes.expires_at IS 'Code expiration (10 minutes from creation)';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_sessions_short_code ON public.sessions(short_code);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_privacy ON public.sessions(privacy);
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX idx_commits_sha ON public.commits(sha);
CREATE INDEX idx_commits_repo ON public.commits(repo_owner, repo_name);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to generate short codes
CREATE OR REPLACE FUNCTION generate_short_code(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate short_code on insert
CREATE OR REPLACE FUNCTION auto_generate_short_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
        NEW.short_code := generate_short_code(8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto short_code
CREATE TRIGGER trigger_auto_short_code
    BEFORE INSERT ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_short_code();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for session summaries (without full messages)
CREATE OR REPLACE VIEW public.session_summaries AS
SELECT
    s.id,
    s.short_code,
    s.project_name,
    s.privacy,
    s.started_at,
    s.ended_at,
    s.message_count,
    s.files_modified,
    s.summary,
    s.created_at,
    p.username,
    p.avatar_url,
    COUNT(sc.commit_id) as commit_count
FROM public.sessions s
LEFT JOIN public.profiles p ON s.user_id = p.id
LEFT JOIN public.session_commits sc ON s.id = sc.session_id
GROUP BY s.id, p.username, p.avatar_url;

-- ============================================================================
-- INITIAL DATA (optional)
-- ============================================================================

-- You can insert test data here if needed

COMMENT ON TABLE public.sessions IS 'Stores Claude Code conversation sessions';
COMMENT ON TABLE public.commits IS 'Stores git commits linked to sessions';
COMMENT ON TABLE public.session_commits IS 'Links sessions to commits (many-to-many)';
