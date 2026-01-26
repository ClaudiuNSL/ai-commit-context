'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import {
  Loader2,
  MessageSquare,
  User,
  Bot,
  FileCode,
  GitCommit,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'human' | 'assistant'
  content: string
  timestamp?: string
}

interface SessionData {
  id: string
  short_code: string
  title: string | null
  messages: Message[]
  files_modified: string[]
  created_at: string
}

export default function SessionViewPage() {
  const params = useParams()
  const code = params.code as string
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadSession()
  }, [code])

  const loadSession = async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await getSupabase()
      .from('sessions')
      .select('*')
      .eq('short_code', code)
      .single()

    if (fetchError) {
      setError('Session not found')
    } else {
      setSession(data)
    }
    setLoading(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <MessageSquare className="w-16 h-16 text-slate-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Session not found</h1>
        <p className="text-slate-400 mb-6">
          This session may have been deleted or the link is incorrect.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">AI Commit Context</span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded">
                {session.short_code}
              </span>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Session info */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">
          {session.title || `Session ${session.short_code}`}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span>{new Date(session.created_at).toLocaleDateString()}</span>
          {session.messages && (
            <span>{session.messages.length} messages</span>
          )}
          {session.files_modified && session.files_modified.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <FileCode className="w-4 h-4" />
              {session.files_modified.length} files modified
            </span>
          )}
        </div>
      </div>

      {/* Files modified */}
      {session.files_modified && session.files_modified.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Files Modified</h3>
            <div className="flex flex-wrap gap-2">
              {session.files_modified.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-sm bg-slate-700 px-2 py-1 rounded font-mono"
                >
                  <FileCode className="w-3 h-3 text-sky-400" />
                  {file}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="space-y-4">
          {session.messages && session.messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-4 p-4 rounded-lg ${
                message.role === 'human'
                  ? 'bg-slate-800/50'
                  : 'bg-indigo-500/10 border border-indigo-500/20'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'human'
                    ? 'bg-slate-700'
                    : 'bg-indigo-500'
                }`}
              >
                {message.role === 'human' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-400 mb-1">
                  {message.role === 'human' ? 'Developer' : 'Claude'}
                </div>
                <div className="text-slate-200 whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!session.messages || session.messages.length === 0) && (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No messages in this session</p>
          </div>
        )}
      </div>
    </div>
  )
}
