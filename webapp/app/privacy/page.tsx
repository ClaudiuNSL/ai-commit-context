import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-slate max-w-none space-y-6">
          <p className="text-slate-300">
            Last updated: February 2026
          </p>

          <h2 className="text-xl font-semibold mt-8">Information We Collect</h2>
          <p className="text-slate-300">
            When you use AI Commit Context, we collect:
          </p>
          <ul className="list-disc pl-6 text-slate-300 space-y-2">
            <li>Claude Code conversation data you choose to upload</li>
            <li>GitHub account information (username, email) when you sign in</li>
            <li>Git commit metadata you choose to link</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8">How We Use Your Data</h2>
          <p className="text-slate-300">
            Your data is used solely to provide the AI Commit Context service:
          </p>
          <ul className="list-disc pl-6 text-slate-300 space-y-2">
            <li>Store and display your uploaded conversations</li>
            <li>Link conversations to commits</li>
            <li>Generate shareable links for code review</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8">Data Storage</h2>
          <p className="text-slate-300">
            Your data is stored securely using Supabase infrastructure.
            Uploaded sessions are set to &quot;unlisted&quot; by default - only accessible via direct link.
          </p>

          <h2 className="text-xl font-semibold mt-8">Data Deletion</h2>
          <p className="text-slate-300">
            You can delete your sessions at any time from your dashboard.
            Deleted data is permanently removed from our servers.
          </p>

          <h2 className="text-xl font-semibold mt-8">Contact</h2>
          <p className="text-slate-300">
            For privacy concerns, contact us via GitHub Issues.
          </p>
        </div>
      </div>
    </div>
  )
}
