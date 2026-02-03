import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-400 mb-6">The page you requested does not exist.</p>
      <Link href="/" className="text-sky-400 hover:underline">Go to home</Link>
    </div>
  )
}
