export async function register() {
  // Only run validation on server startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_APP_URL',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
    ]

    const optionalEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRO_PRICE_ID',
      'STRIPE_TEAM_PRICE_ID',
      'NEXT_PUBLIC_SENTRY_DSN',
    ]

    const missing: string[] = []
    const warnings: string[] = []

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar)
      }
    }

    // Check for Stripe consistency - if one Stripe var is set, all should be
    const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
    const setStripeVars = stripeVars.filter((v) => process.env[v])
    if (setStripeVars.length > 0 && setStripeVars.length < stripeVars.length) {
      const missingStripe = stripeVars.filter((v) => !process.env[v])
      warnings.push(`Stripe partially configured. Missing: ${missingStripe.join(', ')}`)
    }

    if (missing.length > 0) {
      console.error('Missing required environment variables:')
      missing.forEach((v) => console.error(`  - ${v}`))
      console.error('See .env.example for required variables')
      throw new Error(`Missing required env vars: ${missing.join(', ')}`)
    }

    if (warnings.length > 0) {
      console.warn('Environment configuration warnings:')
      warnings.forEach((w) => console.warn(`  - ${w}`))
    }

    console.log('Environment variables validated successfully')
  }
}
