import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const code = requestUrl.searchParams.get('code')

  const redirectWithError = (message: string) => {
    const query = new URLSearchParams({
      error: 'auth_failed',
      error_description: message,
    })
    return NextResponse.redirect(new URL(`/login?${query.toString()}`, requestUrl.origin))
  }

  if (error) {
    return redirectWithError(errorDescription || error)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      const message = exchangeError.message
      if (message.toLowerCase().includes('pkce') || message.toLowerCase().includes('code verifier')) {
        const fallbackUrl = new URL('/auth/callback/client', requestUrl.origin)
        fallbackUrl.search = requestUrl.search
        return NextResponse.redirect(fallbackUrl)
      }
      return redirectWithError(message)
    }
  } else {
    return redirectWithError('Missing authentication code.')
  }

  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
