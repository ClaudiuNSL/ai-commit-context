'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Github, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const { user, loading, signInWithGitHub } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Back to home */}
      <div className="p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="gradient-border p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
              <p className="text-slate-400">Sign in to access your dashboard</p>
            </div>

            <button
              onClick={signInWithGitHub}
              className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-700"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>

            <div className="mt-6 text-center text-sm text-slate-500">
              <p>
                By signing in, you agree to our{' '}
                <Link href="/terms" className="text-sky-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-sky-400 hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700 text-center">
              <p className="text-slate-400">
                Don't have an account?{' '}
                <Link href="/signup" className="text-sky-400 hover:underline font-medium">
                  Sign up free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
