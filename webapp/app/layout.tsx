import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Commit Context - See the conversation behind every commit',
  description: 'Connect your AI coding conversations to GitHub commits. Let your team see the full context of code changes, not just the diff.',
  keywords: ['AI', 'GitHub', 'code review', 'Claude', 'commits', 'pull requests'],
  openGraph: {
    title: 'AI Commit Context',
    description: 'See the conversation behind every commit',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
