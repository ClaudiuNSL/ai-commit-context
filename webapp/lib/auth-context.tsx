'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from './supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  authError: string | null
  signInWithGitHub: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let isMounted = true
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    // Get initial session
    const loadSession = async (attempt = 0) => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      } catch (error: any) {
        if (!isMounted) return
        if (error?.name === 'AbortError') {
          if (attempt < 2) {
            retryTimeout = setTimeout(() => loadSession(attempt + 1), 200 * (attempt + 1))
            return
          }
          // AbortError can be transient during lock contention in dev
          setLoading(false)
          return
        }
        console.error('Failed to get session:', error)
        setAuthError(error?.message ?? 'Failed to load session')
        setLoading(false)
      }
    }

    loadSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Create profile on sign up
        if (event === 'SIGNED_IN' && session?.user) {
          const { user } = session
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingProfile) {
            await supabase.from('profiles').insert({
              id: user.id,
              email: user.email,
              github_username: user.user_metadata?.user_name || user.user_metadata?.preferred_username,
              avatar_url: user.user_metadata?.avatar_url,
            })
          }
        }
      }
    )

    return () => {
      isMounted = false
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGitHub = async () => {
    setAuthError(null)
    const supabase = createClient()
    const appUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || ''
    const redirectTo = new URL('/auth/callback', appUrl).toString()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        scopes: 'read:user user:email',
      },
    })
    if (error) {
      setAuthError(error.message)
    }
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, authError, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
