export async function register() {
  // Only run validation on server startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_APP_URL',
    ]

    const missing: string[] = []

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar)
      }
    }

    if (missing.length > 0) {
      console.error('Missing required environment variables:')
      missing.forEach((v) => console.error(`  - ${v}`))
      console.error('See .env.example for required variables')
      throw new Error(`Missing required env vars: ${missing.join(', ')}`)
    }

    console.log('Environment variables validated successfully')
  }
}
