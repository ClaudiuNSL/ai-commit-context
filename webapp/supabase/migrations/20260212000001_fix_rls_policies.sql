-- Fix RLS policies for commits and session_commits
-- This migration tightens security by restricting INSERT operations to authenticated users

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert commits" ON public.commits;
DROP POLICY IF EXISTS "Anyone can link commits" ON public.session_commits;

-- Create restrictive policies for commits
-- Only authenticated users can insert commits
CREATE POLICY "Authenticated users can insert commits"
    ON public.commits FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create restrictive policies for session_commits
-- Only authenticated users can link commits, and the session must exist
CREATE POLICY "Authenticated users can link commits"
    ON public.session_commits FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Verify the session exists and optionally belongs to the user
        EXISTS (
            SELECT 1 FROM public.sessions
            WHERE id = session_commits.session_id
            AND (user_id = auth.uid() OR user_id IS NULL)
        )
    );
