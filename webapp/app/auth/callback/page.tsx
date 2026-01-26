'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabase()

      // Get the code from URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Auth error:', error)
            router.push('/login?error=auth_failed')
            return
          }
        } catch (err) {
          console.error('Auth exception:', err)
          router.push('/login?error=auth_failed')
          return
        }
      }

      // Check if we have a session
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/login?error=no_session')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-sky-400 mb-4" />
      <p className="text-slate-400">Signing you in...</p>
    </div>
  )
}
