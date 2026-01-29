'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PlanType } from '@/lib/stripe'
import {
  Loader2,
  LogOut,
  MessageSquare,
  GitCommit,
  Copy,
  ExternalLink,
  Plus,
  Settings,
  BarChart3,
  CreditCard,
  Sparkles,
  CheckCircle,
} from 'lucide-react'
import Link from 'next/link'

interface Session {
  id: string
  short_code: string
  title: string | null
  created_at: string
  message_count: number
}

interface Subscription {
  plan: PlanType
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
}

function DashboardContent() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const success = searchParams.get('success')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:56',message:'dashboard_effect_user',data:{hasUser:Boolean(user)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (user) {
      loadSessions()
      loadSubscription()
    }
  }, [user])

  const loadSessions = async () => {
    setLoadingSessions(true)
    setSessionsError(null)

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:67',message:'loadSessions_start',data:{userId:user?.id || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const { data, error } = await createClient()
        .from('sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:79',message:'loadSessions_after_query',data:{hasError:Boolean(error),count:(data ?? []).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      if (error) {
        console.error('Failed to load sessions:', error)
        setSessionsError(error.message)
        setSessions([])
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:75',message:'loadSessions_error',data:{message:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        return
      }

      setSessions(data ?? [])
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:81',message:'loadSessions_success',data:{count:(data ?? []).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setSessionsError('Failed to load sessions. Please try again.')
      setSessions([])
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:86',message:'loadSessions_exception',data:{message:(err as any)?.message || 'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    } finally {
      setLoadingSessions(false)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:103',message:'loadSessions_finally',data:{loadingSessions:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    }
  }

  const loadSubscription = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:107',message:'loadSubscription_start',data:{userId:user?.id || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const { data } = await createClient()
      .from('subscriptions')
      .select('*')
      .eq('user_id', user?.id)
      .single()

    if (data) {
      setSubscription(data)
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:116',message:'loadSubscription_done',data:{hasData:Boolean(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
  }

  const openBillingPortal = async () => {
    const response = await fetch('/api/stripe/create-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id }),
    })
    const { url } = await response.json()
    if (url) window.location.href = url
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }


  if (loading || !user) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:120',message:'dashboard_loading_gate',data:{loading,hasUser:Boolean(user)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-sky-400 to-indigo-500 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">AI Commit Context</span>
            </Link>

            <div className="flex items-center gap-4">
              <button
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-slate-300">
                  {user.user_metadata?.user_name || user.email}
                </span>
              </div>
              <a
                href="/api/auth/signout"
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-400">Subscription activated successfully!</p>
          </div>
        )}

        {/* Subscription card */}
        {subscription && (
          <div className="mb-8 bg-gradient-to-r from-slate-800 to-slate-800/50 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  subscription.plan === 'pro'
                    ? 'bg-sky-500/20'
                    : subscription.plan === 'team'
                    ? 'bg-purple-500/20'
                    : 'bg-slate-700'
                }`}>
                  {subscription.plan !== 'free' ? (
                    <Sparkles className={`w-6 h-6 ${
                      subscription.plan === 'pro' ? 'text-sky-400' : 'text-purple-400'
                    }`} />
                  ) : (
                    <CreditCard className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {PLANS[subscription.plan]?.name || 'Free'} Plan
                    </h3>
                    {subscription.plan !== 'free' && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  {subscription.current_period_end && subscription.plan !== 'free' && (
                    <p className="text-sm text-slate-400">
                      {subscription.cancel_at_period_end
                        ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      }
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {subscription.plan === 'free' ? (
                  <Link
                    href="/pricing"
                    className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Upgrade
                  </Link>
                ) : (
                  <button
                    onClick={openBillingPortal}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Manage Billing
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-500/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-sm text-slate-400">Sessions</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <GitCommit className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-slate-400">Linked Commits</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sessions.reduce((acc, s) => acc + (s.message_count || 0), 0)}
                </p>
                <p className="text-sm text-slate-400">Messages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sessions list */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold">Your Sessions</h2>
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center gap-2 text-sm bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload Session
            </Link>
          </div>

          {loadingSessions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            </div>
          ) : sessionsError ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Could not load sessions</h3>
              <p className="text-slate-400 mb-6">{sessionsError}</p>
              <button
                onClick={loadSessions}
                className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
              <p className="text-slate-400 mb-6">
                Upload your first AI coding session to get started
              </p>
              <div className="max-w-md mx-auto text-left bg-slate-900 rounded-lg p-4 font-mono text-sm">
                <p className="text-slate-500 mb-2"># Install the CLI</p>
                <p className="text-green-400">npm install -g ai-commit-context</p>
                <p className="text-slate-500 mt-4 mb-2"># Initialize in your project</p>
                <p className="text-green-400">acc init</p>
                <p className="text-slate-500 mt-4 mb-2"># Upload your sessions</p>
                <p className="text-green-400">acc upload</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">
                        {session.title || `Session ${session.short_code}`}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="font-mono bg-slate-700 px-2 py-0.5 rounded">
                          {session.short_code}
                        </span>
                        <span>{session.message_count || 0} messages</span>
                        <span>
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyCode(session.short_code)}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        title="Copy share code"
                      >
                        {copiedCode === session.short_code ? (
                          <span className="text-green-400 text-sm">Copied!</span>
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <Link
                        href={`/s/${session.short_code}`}
                        className="p-2 text-slate-400 hover:text-sky-400 transition-colors"
                        title="View session"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
