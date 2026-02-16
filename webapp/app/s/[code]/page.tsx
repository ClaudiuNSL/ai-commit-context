'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2,
  MessageSquare,
  User,
  Bot,
  FileCode,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  GitBranch,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react'
import Link from 'next/link'

interface CleanMessage {
  role: 'user' | 'assistant'
  content: string
  filesModified?: string[]
  timestamp?: string
}

interface RepoInfo {
  name: string
  owner: string
  branch: string
  filesModified: string[]
  commitSha?: string
}

interface SessionData {
  id: string
  shortCode: string
  projectName: string | null
  messages: CleanMessage[]
  repos: RepoInfo[]
  firstUserMessage: string | null
  filesModified: string[]
  startedAt: string
  endedAt?: string
  uploadedAt: string
  messageCount?: number
}

function MessageBubble({ message, isUser }: { message: CleanMessage; isUser: boolean }) {
  const [filesExpanded, setFilesExpanded] = useState(false)

  return (
    <div
      className={`flex gap-4 p-4 rounded-lg ${
        isUser
          ? 'bg-slate-800/50'
          : 'bg-indigo-500/10 border border-indigo-500/20'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-slate-700' : 'bg-indigo-500'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-400 mb-1">
          {isUser ? 'Developer' : 'Claude'}
        </div>
        <div className="text-slate-200 whitespace-pre-wrap break-words">
          {message.content}
        </div>
        {message.filesModified && message.filesModified.length > 0 && (
          <button
            onClick={() => setFilesExpanded(!filesExpanded)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
          >
            {filesExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            Modified {message.filesModified.length} file{message.filesModified.length !== 1 ? 's' : ''}
          </button>
        )}
        {filesExpanded && message.filesModified && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.filesModified.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs bg-slate-700 px-2 py-0.5 rounded font-mono"
              >
                <FileCode className="w-3 h-3 text-sky-400" />
                {file}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RepoBadge({ repo }: { repo: RepoInfo }) {
  const githubUrl = `https://github.com/${repo.owner}/${repo.name}`
  const branchUrl = `${githubUrl}/tree/${repo.branch}`

  return (
    <a
      href={branchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition-colors"
    >
      <GitBranch className="w-4 h-4 text-green-400" />
      <span className="font-medium">{repo.owner}/{repo.name}</span>
      <span className="text-slate-400">:{repo.branch}</span>
      <ExternalLink className="w-3 h-3 text-slate-400" />
    </a>
  )
}

function FilesSummary({ repos }: { repos: RepoInfo[] }) {
  const [expanded, setExpanded] = useState(false)
  const totalFiles = repos.reduce((sum, r) => sum + r.filesModified.length, 0)

  if (totalFiles === 0) return null

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2 text-sm">
          <FileCode className="w-4 h-4 text-sky-400" />
          <span>{totalFiles} file{totalFiles !== 1 ? 's' : ''} modified</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {repos.map((repo, repoIndex) => (
            <div key={repoIndex}>
              {repos.length > 1 && (
                <div className="text-xs text-slate-500 mb-2">
                  {repo.owner}/{repo.name}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {repo.filesModified.map((file, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs bg-slate-700 px-2 py-1 rounded font-mono"
                  >
                    {file}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SessionViewPage() {
  const params = useParams()
  const code = params.code as string
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [detailedView, setDetailedView] = useState(false)

  useEffect(() => {
    loadSession()
  }, [code])

  const loadSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${code}`)
      if (!response.ok) {
        setError('Session not found')
        setLoading(false)
        return
      }
      const data = await response.json()
      setSession(data)
    } catch {
      setError('Failed to load session')
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

  // Use cleanMessages if available, fallback to messages
  const displayMessages = (session as unknown as { cleanMessages?: CleanMessage[] }).cleanMessages || session.messages as CleanMessage[]

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
              <button
                onClick={() => setDetailedView(!detailedView)}
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                title={detailedView ? 'Show clean view' : 'Show detailed view'}
              >
                {detailedView ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {detailedView ? 'Clean' : 'Detailed'}
                </span>
              </button>
              <span className="font-mono text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded">
                {session.shortCode}
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
          {session.projectName || `Session ${session.shortCode}`}
        </h1>

        {/* First user message preview */}
        {session.firstUserMessage && (
          <p className="text-slate-400 mb-4 text-sm italic">
            &ldquo;{session.firstUserMessage}&rdquo;
          </p>
        )}

        {/* Repo badges */}
        {session.repos && session.repos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {session.repos.map((repo, i) => (
              <RepoBadge key={i} repo={repo} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span>{new Date(session.uploadedAt || session.startedAt).toLocaleDateString()}</span>
          {displayMessages && (
            <span>{displayMessages.length} messages</span>
          )}
        </div>
      </div>

      {/* Files summary */}
      {session.repos && (
        <div className="max-w-4xl mx-auto px-4 mb-6">
          <FilesSummary repos={session.repos} />
        </div>
      )}

      {/* Messages */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        {detailedView ? (
          // Detailed view - raw JSON
          <div className="bg-slate-800/50 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
              {JSON.stringify(displayMessages, null, 2)}
            </pre>
          </div>
        ) : (
          // Clean conversation view
          <div className="space-y-4">
            {displayMessages?.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                isUser={message.role === 'user'}
              />
            ))}
          </div>
        )}

        {(!displayMessages || displayMessages.length === 0) && !detailedView && (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No messages in this session</p>
          </div>
        )}
      </div>
    </div>
  )
}
