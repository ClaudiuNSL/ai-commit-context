'use client'

import { useAuth } from '@/lib/auth-context'
import { PLANS, PlanType } from '@/lib/stripe'
import { Check, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { getSupabase } from '@/lib/supabase'

function PricingContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading] = useState<string | null>(null)
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    if (user) {
      loadSubscription()
    }
  }, [user])

  const loadSubscription = async () => {
    const { data } = await getSupabase()
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user?.id)
      .single()

    if (data) {
      setCurrentPlan(data.plan)
    }
  }

  const handleSubscribe = async (plan: PlanType) => {
    if (!user) {
      router.push(`/signup?plan=${plan}`)
      return
    }

    if (plan === 'free') return

    setLoading(plan)

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          userId: user.id,
          email: user.email,
        }),
      })

      const { url, error } = await response.json()

      if (error) {
        alert(error)
        return
      }

      window.location.href = url
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link
            href={user ? '/dashboard' : '/'}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {user ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-16">
        {canceled && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-center">
            <p className="text-yellow-400">Checkout was canceled. No charges were made.</p>
          </div>
        )}

        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-lg">Start free, upgrade when you need more</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {(Object.entries(PLANS) as [PlanType, typeof PLANS[PlanType]][]).map(([key, plan]) => (
            <div
              key={key}
              className={`rounded-xl p-8 ${
                key === 'pro'
                  ? 'gradient-border bg-slate-900'
                  : 'bg-slate-800/50 border border-slate-700'
              }`}
            >
              {key === 'pro' && (
                <div className="inline-block bg-sky-500/10 text-sky-400 text-sm px-3 py-1 rounded-full mb-4">
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <div className="text-4xl font-bold mb-4">
                ${plan.price}
                <span className="text-lg text-slate-400">/mo</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(key)}
                disabled={loading !== null || currentPlan === key}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  currentPlan === key
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : key === 'pro'
                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                {loading === key ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : currentPlan === key ? (
                  'Current Plan'
                ) : key === 'free' ? (
                  'Get Started'
                ) : (
                  'Subscribe'
                )}
              </button>
            </div>
          ))}
        </div>

        {user && currentPlan !== 'free' && (
          <div className="text-center mt-12">
            <button
              onClick={async () => {
                const response = await fetch('/api/stripe/create-portal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user.id }),
                })
                const { url } = await response.json()
                if (url) window.location.href = url
              }}
              className="text-slate-400 hover:text-white transition-colors underline"
            >
              Manage subscription
            </button>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.',
              },
              {
                q: 'Is there a free trial?',
                a: 'The Free plan is always available with basic features. Pro and Team plans don\'t have a trial, but you can cancel within the first 7 days for a full refund.',
              },
              {
                q: 'Can I upgrade or downgrade later?',
                a: 'Yes, you can change your plan at any time. When upgrading, you\'ll be charged the prorated amount. When downgrading, the change takes effect at the end of your billing period.',
              },
            ].map((faq, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}
