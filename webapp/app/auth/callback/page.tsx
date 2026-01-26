'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, 'Session:', session)

        if (event === 'SIGNED_IN' && session) {
          router.push('/dashboard')
        } else if (event === 'TOKEN_REFRESHED' && session) {
          router.push('/dashboard')
        }
      }
    )

    // Also try to get session from URL hash (for implicit flow)
    const handleCallback = async () => {
      // Check URL for hash fragments (implicit flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')

      if (accessToken) {
        // Implicit flow - token in URL hash
        const { data, error } = await supabase.auth.getSession()
        if (data.session) {
          router.push('/dashboard')
          return
        }
      }

      // Check for code parameter (PKCE flow)
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const errorParam = params.get('error')
      const errorDescription = params.get('error_description')

      if (errorParam) {
        console.error('OAuth error:', errorParam, errorDescription)
        setError(errorDescription || errorParam)
        setTimeout(() => router.push('/login?error=auth_failed'), 2000)
        return
      }

      if (code) {
        try {
          console.log('Exchanging code for session...')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Exchange error:', error)
            setError(error.message)
            setTimeout(() => router.push('/login?error=auth_failed'), 2000)
            return
          }

          if (data.session) {
            console.log('Session obtained, redirecting...')
            router.push('/dashboard')
            return
          }
        } catch (err) {
          console.error('Exchange exception:', err)
          setError('Failed to complete authentication')
          setTimeout(() => router.push('/login?error=auth_failed'), 2000)
          return
        }
      }

      // No code and no token - wait a bit for onAuthStateChange
      // Then check session
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.push('/dashboard')
        } else {
          console.log('No session found after timeout')
          router.push('/login?error=no_session')
        }
      }, 2000)
    }

    handleCallback()

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      {error ? (
        <>
          <p className="text-red-400 mb-2">Authentication Error</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <p className="text-slate-500 text-xs mt-2">Redirecting to login...</p>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-4" />
          <p className="text-slate-400">Signing you in...</p>
        </>
      )}
    </div>
  )
}
