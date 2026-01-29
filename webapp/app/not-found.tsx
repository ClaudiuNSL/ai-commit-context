'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function NotFound() {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d7344264-ebce-4aee-8b79-23cf989cef3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/not-found.tsx:7',message:'not_found_render',data:{path:typeof window !== 'undefined' ? window.location.pathname : 'server'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-400 mb-6">The page you requested does not exist.</p>
      <Link href="/" className="text-sky-400 hover:underline">Go to home</Link>
    </div>
  )
}
