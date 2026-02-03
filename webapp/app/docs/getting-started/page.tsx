import Link from 'next/link'
import { ArrowLeft, TerminalSquare } from 'lucide-react'

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <h1 className="mt-6 text-3xl font-bold">Upload your first session</h1>
        <p className="mt-2 text-slate-400">
          Sessions are uploaded from your local machine using the ACC CLI.
        </p>

        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <div className="flex items-center gap-3 text-slate-200">
            <TerminalSquare className="h-5 w-5 text-sky-400" />
            <span className="font-semibold">Quick start</span>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-lg bg-slate-900 p-4 font-mono text-slate-200">
              <p className="text-slate-500"># Install the CLI</p>
              <p className="text-green-400">npm install -g ai-commit-context</p>
              <p className="mt-4 text-slate-500"># Initialize in your project</p>
              <p className="text-green-400">acc init</p>
              <p className="mt-4 text-slate-500"># Upload your sessions</p>
              <p className="text-green-400">acc upload</p>
            </div>

            <p className="text-slate-400">
              After upload, refresh the dashboard to see your sessions list.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
