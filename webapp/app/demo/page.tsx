'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  User,
  Bot,
  FileCode,
} from 'lucide-react'

const demoSession = {
  title: 'Demo: Add OAuth login',
  shortCode: 'DEMO-123',
  createdAt: new Date('2026-01-20T10:30:00Z'),
  files: ['app/login/page.tsx', 'lib/auth-context.tsx', 'middleware.ts'],
  messages: [
    {
      role: 'human',
      content: 'Add GitHub OAuth with a simple login screen.',
    },
    {
      role: 'assistant',
      content:
        'I will add a GitHub OAuth button and a callback handler. We will store the session and redirect to the dashboard.',
    },
    {
      role: 'human',
      content: 'Also show a quick error message if sign in fails.',
    },
  ],
}

export default function DemoPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => router.push('/signup')}
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create free account <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900/60 p-6">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare className="w-5 h-5 text-sky-400" />
            <h1 className="text-2xl font-bold">Demo workspace</h1>
          </div>
          <p className="text-slate-400">
            This is a limited preview. You can explore one sample session, then sign up to start
            uploading your own.
          </p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 mb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-4">
            <span className="font-mono bg-slate-800 px-2 py-1 rounded">{demoSession.shortCode}</span>
            <span>{demoSession.createdAt.toLocaleDateString()}</span>
            <span>{demoSession.messages.length} messages</span>
            <span className="inline-flex items-center gap-1">
              <FileCode className="w-4 h-4" />
              {demoSession.files.length} files modified
            </span>
          </div>
          <h2 className="text-xl font-semibold mb-4">{demoSession.title}</h2>

          <div className="space-y-4">
            {demoSession.messages.map((message, index) => (
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
                    message.role === 'human' ? 'bg-slate-700' : 'bg-indigo-500'
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
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Ready to upload your own sessions?</h3>
          <p className="text-slate-400 mb-4">
            Create a free account to connect GitHub and start capturing AI commit context.
          </p>
          <button
            type="button"
            onClick={() => router.push('/signup')}
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            Sign up free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  )
}
