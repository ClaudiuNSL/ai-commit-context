'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Github, Terminal, Check, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type PageState = 'loading' | 'pending' | 'success' | 'error'

interface DeviceCodeStatus {
  exists: boolean
  expired: boolean
  completed: boolean
}

function CLIAuthContent() {
  const searchParams = useSearchParams()
  const deviceCode = searchParams.get('code')
  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')

  const [state, setState] = useState<PageState>('loading')
  const [codeStatus, setCodeStatus] = useState<DeviceCodeStatus | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    // Handle success/error from OAuth callback
    if (successParam === 'true') {
      setState('success')
      return
    }

    if (errorParam) {
      setState('error')
      return
    }

    // If no device code, just show the page without code
    if (!deviceCode) {
      setState('pending')
      return
    }

    // Validate the device code
    const validateCode = async () => {
      try {
        const response = await fetch(`/api/auth/device-code?code=${encodeURIComponent(deviceCode)}`)
        const data = await response.json()

        if (!response.ok) {
          setCodeStatus({ exists: false, expired: false, completed: false })
          setState('error')
          return
        }

        setCodeStatus(data)

        if (data.completed) {
          setState('success')
        } else if (data.expired) {
          setState('error')
        } else {
          setState('pending')
        }
      } catch {
        setState('error')
      }
    }

    validateCode()
  }, [deviceCode, successParam, errorParam])

  // Auto-redirect to dashboard after successful auth
  useEffect(() => {
    if (state === 'success') {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard'
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state])

  const handleSignIn = async () => {
    setIsAuthenticating(true)

    try {
      // Get GitHub OAuth URL from API (server-side has the client ID)
      const response = await fetch(`/api/auth/github-url?device_code=${encodeURIComponent(deviceCode || '')}`)
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setState('error')
        setIsAuthenticating(false)
      }
    } catch {
      setState('error')
      setIsAuthenticating(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="gradient-border p-8 text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-400" />
              </div>

              <h1 className="text-2xl font-bold mb-2">CLI Authenticated</h1>
              <p className="text-slate-400 mb-6">
                Your CLI is now connected to your account. Redirecting to dashboard...
              </p>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-4"
              >
                Go to Dashboard
              </Link>

              <p className="text-sm text-slate-500">
                Or close this window and return to your terminal
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    const errorMessage = codeStatus?.expired
      ? 'This authentication code has expired. Please run the login command again in your terminal.'
      : errorParam
        ? decodeURIComponent(errorParam)
        : !codeStatus?.exists
          ? 'Invalid authentication code. Please run the login command again in your terminal.'
          : 'An error occurred during authentication. Please try again.'

    return (
      <div className="min-h-screen flex flex-col">
        <div className="p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="gradient-border p-8 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>

              <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
              <p className="text-slate-400 mb-6">{errorMessage}</p>

              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-300">Run this command to start over:</p>
                <code className="block mt-2 text-sky-400 font-mono text-sm">acc auth login</code>
              </div>

              <Link
                href="/"
                className="text-sky-400 hover:underline text-sm"
              >
                Return to homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Pending state - show sign in button
  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="gradient-border p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Terminal className="w-8 h-8 text-sky-400" />
              </div>

              <h1 className="text-2xl font-bold mb-2">Authenticate CLI</h1>
              <p className="text-slate-400">
                Sign in with GitHub to connect your CLI to AI Commit Context
              </p>
            </div>

            {deviceCode && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 text-center">
                <p className="text-sm text-slate-400 mb-2">Your device code</p>
                <code className="text-2xl font-mono font-bold text-sky-400 tracking-wider">
                  {deviceCode}
                </code>
                <p className="text-xs text-slate-500 mt-2">
                  Make sure this matches the code shown in your terminal
                </p>
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-700"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting to GitHub...
                </>
              ) : (
                <>
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </>
              )}
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

            {!deviceCode && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-sm text-slate-400 text-center">
                  To authenticate your CLI, run:{' '}
                  <code className="text-sky-400 font-mono">acc auth login</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CLIAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      }
    >
      <CLIAuthContent />
    </Suspense>
  )
}
