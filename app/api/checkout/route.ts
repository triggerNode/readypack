import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { rateLimit, clientIpFrom } from '@/lib/rate-limit'

export const runtime = 'nodejs'

type Tier = 'solo' | 'procurement_ready' | 'adviser'

type TierConfig = {
  displayName: string
  amountPence: number
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  solo: { displayName: 'Solo Pack', amountPence: 24900 },
  procurement_ready: { displayName: 'Procurement-Ready Pack', amountPence: 49900 },
  adviser: { displayName: 'Adviser Pack', amountPence: 79900 },
}

function isTier(value: unknown): value is Tier {
  return value === 'solo' || value === 'procurement_ready' || value === 'adviser'
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpFrom(request.headers)
    const limit = rateLimit(`checkout:${ip}`, { windowMs: 60_000, maxRequests: 3 })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        { status: 429 },
      )
    }

    const body = (await request.json()) as { tier?: unknown }
    const tier = body?.tier

    if (!isTier(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be one of: solo, procurement_ready, adviser.' },
        { status: 400 },
      )
    }

    const config = TIER_CONFIG[tier]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Omit payment_method_types so Stripe auto-enables every method the
      // merchant account supports (cards, Apple Pay, Google Pay, etc.).
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: config.amountPence,
            product_data: {
              name: config.displayName,
              description:
                'ReadyPack compliance documentation pack — delivered within 48 hours of submitted intake.',
            },
          },
        },
      ],
      metadata: {
        plan_selected: tier,
      },
      success_url: `${appUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#pricing`,
      billing_address_collection: 'required',
      customer_creation: 'always',
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to create checkout session.'
    console.error('Checkout API error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
