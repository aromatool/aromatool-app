import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY         = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
// URL-ul aplicației pentru redirect după checkout (ex. https://app.aromatool.com)
const APP_URL                   = Deno.env.get('APP_URL') ?? ''

// Mapping plan → Stripe Price ID (le creezi în Stripe Dashboard).
// La lansare folosim un singur plan: „pro" (STRIPE_PRICE_PRO, lunar).
// Restul rămân pentru compatibilitate dacă au fost vreodată setate.
const PRICE_BY_PLAN: Record<string, string> = {
  pro:      Deno.env.get('STRIPE_PRICE_PRO')      ?? '',
  starter:  Deno.env.get('STRIPE_PRICE_STARTER')  ?? '',
  growth:   Deno.env.get('STRIPE_PRICE_GROWTH')   ?? '',
  team:     Deno.env.get('STRIPE_PRICE_TEAM')     ?? '',
  business: Deno.env.get('STRIPE_PRICE_BUSINESS') ?? '',
}

// Preț anual pentru „pro" (ex. 100 €/an). Doar pentru pro; planul rămâne
// „pro" în DB (nu introducem o valoare nouă în CHECK constraint) — diferă
// doar intervalul de facturare (Stripe Price recurring=year).
const STRIPE_PRICE_PRO_ANNUAL = Deno.env.get('STRIPE_PRICE_PRO_ANNUAL') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    if (!STRIPE_SECRET_KEY) return json({ error: 'Stripe nu este configurat.' }, 500)

    const { plan, interval } = await req.json()
    // Facturare anuală: doar pentru „pro", dacă prețul anual e configurat.
    const annual = interval === 'year' && plan === 'pro' && !!STRIPE_PRICE_PRO_ANNUAL
    const priceId = annual ? STRIPE_PRICE_PRO_ANNUAL : PRICE_BY_PLAN[plan as string]
    if (!priceId) return json({ error: `Plan invalid sau preț neconfigurat: ${plan}` }, 400)
    // Planul stocat în DB rămâne neschimbat (ex. „pro") — vezi CHECK constraint.
    // Intervalul îl trecem doar ca metadata informativă (nu schimbă accesul).
    const billingInterval = annual ? 'year' : 'month'

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // ── Customer: refolosește dacă există, altfel creează ────
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id as string | null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // ── Checkout Session (abonament) ─────────────────────────
    const base = APP_URL || new URL(req.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Permite introducerea codurilor de lansare (promotion codes) la checkout.
      allow_promotion_codes: true,
      // ── MULTI-COUNTRY ────────────────────────────────────
      // Valuta clientului e aleasă automat de Stripe DACĂ Price-ul are
      // currency_options (RON, EUR, ...) setate în Dashboard.
      // Colectăm adresa pentru factură + ca bază pentru alegerea valutei.
      billing_address_collection: 'auto',
      // TVA automat (Stripe Tax) — DEZACTIVAT temporar până configurăm
      // partea fiscală în Dashboard. Cu el activat fără setup, checkout-ul
      // dă eroare. De reactivat: automatic_tax + tax_id_collection +
      // customer_update:{address:'auto',name:'auto'}.
      success_url: `${base}/app/settings?upgrade=success`,
      cancel_url: `${base}/app/settings?upgrade=cancel`,
      // metadata e citită de webhook ca să seteze planul
      metadata: { supabase_user_id: user.id, plan, interval: billingInterval },
      subscription_data: { metadata: { supabase_user_id: user.id, plan, interval: billingInterval } },
    })

    return json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('create-checkout error:', message)
    return json({ error: message }, 500)
  }
})
