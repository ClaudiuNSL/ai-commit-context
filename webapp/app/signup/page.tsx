'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Github, ArrowLeft, Loader2, Check } from 'lucide-react'
import Link from 'next/link'

const features = [
  'Unlimited conversation tracking',
  'Link commits to AI context',
  'Share with your team',
  'GitHub integration',
]

export default function SignupPage() {
  const { user, loading, signInWithGitHub, authError } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const errorMessage =
    authError || errorDescription || (errorParam ? 'Authentication failed. Please try again.' : null)

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

      {/* Signup form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
          {/* Left side - Benefits */}
          <div className="hidden md:block">
            <h2 className="text-2xl font-bold mb-6">
              Start understanding your code changes better
            </h2>
            <ul className="space-y-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-sky-400" />
                  </div>
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400">
                "AI Commit Context has transformed how our team reviews code.
                We finally understand the 'why' behind every change."
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400" />
                <div>
                  <p className="text-sm font-medium">Alex Developer</p>
                  <p className="text-xs text-slate-500">Engineering Lead</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Form */}
          <div className="gradient-border p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Create your account</h1>
              <p className="text-slate-400">Get started for free, no credit card required</p>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              onClick={signInWithGitHub}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <Github className="w-5 h-5" />
              Sign up with GitHub
            </button>

            <div className="mt-6 text-center text-sm text-slate-500">
              <p>
                By signing up, you agree to our{' '}
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
                Already have an account?{' '}
                <Link href="/login" className="text-sky-400 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
