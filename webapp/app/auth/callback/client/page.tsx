'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      const code = searchParams.get('code')

      if (errorParam) {
        setError(errorDescription || errorParam)
        router.replace(`/login?error=${encodeURIComponent(errorParam)}&error_description=${encodeURIComponent(errorDescription || '')}`)
        return
      }

      if (!code) {
        setError('Missing authentication code.')
        router.replace('/login?error=auth_failed&error_description=Missing%20authentication%20code')
        return
      }

      const supabase = createClient()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        setError(exchangeError.message)
        router.replace(
          `/login?error=auth_failed&error_description=${encodeURIComponent(exchangeError.message)}`
        )
        return
      }

      router.replace('/dashboard')
    }

    handleCallback()
  }, [router, searchParams])

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
          <p className="text-slate-400">Completing sign in...</p>
        </>
      )}
    </div>
  )
}

export default function AuthCallbackClientPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
