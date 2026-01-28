'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const handleCallback = async () => {
      const redirectWithError = (message: string) => {
        const query = new URLSearchParams({
          error: 'auth_failed',
          error_description: message,
        })
        setTimeout(() => router.push(`/login?${query.toString()}`), 2000)
      }

      // Check for error in URL params
      const params = new URLSearchParams(window.location.search)
      const errorParam = params.get('error')
      const errorDescription = params.get('error_description')
      const code = params.get('code')

      if (errorParam) {
        console.error('OAuth error:', errorParam, errorDescription)
        setError(errorDescription || errorParam)
        redirectWithError(errorDescription || errorParam)
        return
      }

      if (code) {
        const handledKey = `supabase-oauth-handled:${code}`
        if (sessionStorage.getItem(handledKey)) {
          return
        }
        sessionStorage.setItem(handledKey, 'true')

        // Exchange code for session - @supabase/ssr handles PKCE verifier via cookies
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('Exchange error:', error)
            setError(error.message)
            redirectWithError(error.message)
            return
          }

          // Session is now set, redirect to dashboard
          router.push('/dashboard')
          return
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // Retry once after a short delay to avoid lock race in dev
            setTimeout(async () => {
              try {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (error) {
                  console.error('Exchange retry error:', error)
                  setError(error.message)
                  redirectWithError(error.message)
                  return
                }
                router.push('/dashboard')
              } catch (retryErr: any) {
                console.error('Exchange retry exception:', retryErr)
                setError('Failed to complete authentication')
                redirectWithError('Failed to complete authentication')
              }
            }, 200)
            return
          }
          console.error('Exchange exception:', err)
          setError('Failed to complete authentication')
          redirectWithError('Failed to complete authentication')
          return
        }
      }

      // No code in URL - check if we already have a session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        // No session and no code, redirect to login
        router.push('/login')
      }
    }

    handleCallback()
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
