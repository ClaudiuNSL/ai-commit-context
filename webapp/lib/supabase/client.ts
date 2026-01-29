import { createBrowserClient } from '@supabase/ssr'

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>

const CLIENT_KEY = '__acc_supabase_client__'

// No-op lock to prevent AbortError in React Strict Mode
const noopLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => {
  return fn()
}

const authConfig = {
  flowType: 'pkce' as const,
  detectSessionInUrl: false,
  persistSession: true,
  autoRefreshToken: true,
  lock: noopLock,
}

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: authConfig }
    )
  }

  const existing = (window as unknown as Record<string, SupabaseBrowserClient | undefined>)[CLIENT_KEY]
  if (existing) {
    return existing
  }

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: authConfig }
  )

  ;(window as unknown as Record<string, SupabaseBrowserClient>)[CLIENT_KEY] = client
  return client
}
