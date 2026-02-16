import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe() {
  // Return null if Stripe is not configured (payments disabled)
  if (!process.env.STRIPE_SECRET_KEY) {
    return null
  }

  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    })
  }
  return stripeInstance
}

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      '5 sessions/month',
      '1 repository',
      '7 day history',
      'Community support',
    ],
    limits: {
      sessionsPerMonth: 5,
      repositories: 1,
      historyDays: 7,
    },
  },
  pro: {
    name: 'Pro',
    price: 9,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      'Unlimited sessions',
      '10 repositories',
      'Unlimited history',
      'Priority support',
      'GitHub Action',
    ],
    limits: {
      sessionsPerMonth: -1, // unlimited
      repositories: 10,
      historyDays: -1, // unlimited
    },
  },
  team: {
    name: 'Team',
    price: 29,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    features: [
      'Everything in Pro',
      '5 team members',
      'Team dashboard',
      'Analytics',
      'SSO (coming soon)',
    ],
    limits: {
      sessionsPerMonth: -1,
      repositories: -1,
      historyDays: -1,
      teamMembers: 5,
    },
  },
} as const

export type PlanType = keyof typeof PLANS
