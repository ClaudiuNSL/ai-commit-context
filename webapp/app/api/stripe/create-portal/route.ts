import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'stripe/create-portal' })

export async function POST(request: NextRequest) {
  const stripe = getStripe()

  // Return 503 if Stripe is not configured
  if (!stripe) {
    return NextResponse.json(
      { error: 'Billing portal not available. Please contact support.' },
      { status: 503 }
    )
  }

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Get subscription with customer ID
    const supabase = getSupabaseAdmin()
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      )
    }

    // Create portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-commit-context.vercel.app'

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    })

    log.info('Portal session created', { userId })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    log.error('Failed to create portal session', error)
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
