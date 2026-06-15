import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// ─── CONFIG ──────────────────────────────────────────────────
// Citește prețul planului „pro" direct din Stripe (sursa de adevăr) și
// îl returnează în toate valutele configurate (currency_options), ca să
// afișăm în paywall suma corectă pentru țara clientului.
// Public (verify_jwt = false): prețul nu e date sensibile.
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_PRICE_PRO  = Deno.env.get('STRIPE_PRICE_PRO')  ?? ''

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
    // Dacă Stripe nu e configurat încă, răspundem „neconfigurat" fără
    // eroare — frontend-ul cade pe textul de preț static (fallback).
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_PRO) {
      return json({ configured: false })
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const price = await stripe.prices.retrieve(STRIPE_PRICE_PRO, {
      expand: ['currency_options'],
    })

    // Valutele: valuta de bază + currency_options (multi-valută din Dashboard).
    // Sumele rămân în unități minore (bani/cents); formatarea se face în UI.
    const currencies: Record<string, { amount: number }> = {}

    if (typeof price.unit_amount === 'number' && price.currency) {
      currencies[price.currency] = { amount: price.unit_amount }
    }

    const opts = (price.currency_options ?? {}) as Record<
      string,
      { unit_amount?: number | null }
    >
    for (const [cur, opt] of Object.entries(opts)) {
      if (typeof opt?.unit_amount === 'number') {
        currencies[cur] = { amount: opt.unit_amount }
      }
    }

    return json({
      configured: true,
      interval: price.recurring?.interval ?? 'month',
      currencies, // ex: { ron: { amount: 9900 }, eur: { amount: 1990 } }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('get-plan-price error:', message)
    // Nu blocăm UI-ul pentru o eroare de preț — semnalăm „neconfigurat".
    return json({ configured: false, error: message }, 200)
  }
})
