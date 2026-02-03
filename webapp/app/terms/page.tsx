import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-invert prose-slate max-w-none space-y-6">
          <p className="text-slate-300">
            Last updated: February 2026
          </p>

          <h2 className="text-xl font-semibold mt-8">Acceptance of Terms</h2>
          <p className="text-slate-300">
            By using AI Commit Context, you agree to these terms of service.
          </p>

          <h2 className="text-xl font-semibold mt-8">Service Description</h2>
          <p className="text-slate-300">
            AI Commit Context allows you to upload Claude Code conversations and link them
            to your git commits for better code review context.
          </p>

          <h2 className="text-xl font-semibold mt-8">User Responsibilities</h2>
          <ul className="list-disc pl-6 text-slate-300 space-y-2">
            <li>You are responsible for the content you upload</li>
            <li>Do not upload sensitive information (API keys, passwords, secrets)</li>
            <li>Do not use the service for illegal purposes</li>
            <li>Respect the intellectual property of others</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8">Content Ownership</h2>
          <p className="text-slate-300">
            You retain ownership of all content you upload. By uploading, you grant us
            a license to store and display your content for the purpose of providing the service.
          </p>

          <h2 className="text-xl font-semibold mt-8">Service Availability</h2>
          <p className="text-slate-300">
            We strive to maintain high availability but do not guarantee uninterrupted service.
            We may modify or discontinue features at any time.
          </p>

          <h2 className="text-xl font-semibold mt-8">Limitation of Liability</h2>
          <p className="text-slate-300">
            AI Commit Context is provided &quot;as is&quot; without warranties.
            We are not liable for any damages arising from your use of the service.
          </p>

          <h2 className="text-xl font-semibold mt-8">Contact</h2>
          <p className="text-slate-300">
            For questions about these terms, contact us via GitHub Issues.
          </p>
        </div>
      </div>
    </div>
  )
}
