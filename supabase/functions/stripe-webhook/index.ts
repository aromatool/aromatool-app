import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY         = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
// Secretul de signing al webhook-ului (Stripe Dashboard → Webhooks)
const STRIPE_WEBHOOK_SECRET     = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

// Mapping invers Price ID → plan (pentru evenimente fără metadata)
const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_STARTER')  ?? '_starter']:  'starter',
  [Deno.env.get('STRIPE_PRICE_GROWTH')   ?? '_growth']:   'growth',
  [Deno.env.get('STRIPE_PRICE_TEAM')     ?? '_team']:     'team',
  [Deno.env.get('STRIPE_PRICE_BUSINESS') ?? '_business']: 'business',
}

serve(async (req) => {
  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return new Response('Stripe webhook not configured', { status: 500 })
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const signature = req.headers.get('stripe-signature')
    if (!signature) return new Response('Missing signature', { status: 400 })

    const rawBody = await req.text()

    // Verificare semnătură (async în Deno)
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody, signature, STRIPE_WEBHOOK_SECRET,
      )
    } catch (err) {
      console.error('stripe-webhook: invalid signature', err)
      return new Response('Invalid signature', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Helper: setează planul pentru un user (după supabase_user_id sau customer)
    async function setPlan(opts: {
      userId?: string | null
      customerId?: string | null
      plan: string
      status?: string
    }) {
      const patch: Record<string, unknown> = {
        subscription_plan: opts.plan,
        ...(opts.status ? { subscription_status: opts.status } : {}),
        updated_at: new Date().toISOString(),
      }
      if (opts.userId) {
        await supabase.from('profiles').update(patch).eq('id', opts.userId)
      } else if (opts.customerId) {
        await supabase.from('profiles').update(patch).eq('stripe_customer_id', opts.customerId)
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session
        await setPlan({
          userId: s.metadata?.supabase_user_id ?? null,
          customerId: typeof s.customer === 'string' ? s.customer : null,
          plan: s.metadata?.plan ?? 'starter',
          status: 'active',
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id ?? ''
        const plan = sub.metadata?.plan ?? PLAN_BY_PRICE[priceId] ?? 'starter'
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'canceled'
          : 'inactive'
        await setPlan({
          customerId: typeof sub.customer === 'string' ? sub.customer : null,
          plan,
          status,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        // Downgrade la trial/inactiv când abonamentul se termină
        await setPlan({
          customerId: typeof sub.customer === 'string' ? sub.customer : null,
          plan: 'trial',
          status: 'canceled',
        })
        break
      }

      default:
        // Alte evenimente — ignorate
        break
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('stripe-webhook error:', err)
    return new Response('Webhook error', { status: 500 })
  }
})
