'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Github, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const { user, loading, signInWithGitHub, signOut, authError } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const errorMessage =
    authError || errorDescription || (errorParam ? 'Authentication failed. Please try again.' : null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md gradient-border p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">You are already signed in</h1>
          <p className="text-slate-400 mb-6">
            Continue to your dashboard or sign out to use a different account.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              Go to dashboard
            </button>
            <a
              href="/api/auth/signout"
              className="w-full block text-center bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-lg font-medium transition-colors border border-slate-700"
            >
              Sign out
            </a>
          </div>
        </div>
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

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

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
