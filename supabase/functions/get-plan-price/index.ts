import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// ─── CONFIG ──────────────────────────────────────────────────
// Citește prețul planului „pro" direct din Stripe (sursa de adevăr) și
// îl returnează în toate valutele configurate (currency_options), ca să
// afișăm în paywall suma corectă pentru țara clientului.
// Public (verify_jwt = false): prețul nu e date sensibile.
const STRIPE_SECRET_KEY       = Deno.env.get('STRIPE_SECRET_KEY')       ?? ''
const STRIPE_PRICE_PRO        = Deno.env.get('STRIPE_PRICE_PRO')        ?? ''
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
    // Dacă Stripe nu e configurat încă, răspundem „neconfigurat" fără
    // eroare — frontend-ul cade pe textul de preț static (fallback).
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_PRO) {
      return json({ configured: false })
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Extrage toate valutele unui Price (valuta de bază + currency_options).
    // Sumele rămân în unități minore (bani/cents); formatarea se face în UI.
    const currenciesOf = (price: Stripe.Price): Record<string, { amount: number }> => {
      const out: Record<string, { amount: number }> = {}
      if (typeof price.unit_amount === 'number' && price.currency) {
        out[price.currency] = { amount: price.unit_amount }
      }
      const opts = (price.currency_options ?? {}) as Record<
        string,
        { unit_amount?: number | null }
      >
      for (const [cur, opt] of Object.entries(opts)) {
        if (typeof opt?.unit_amount === 'number') {
          out[cur] = { amount: opt.unit_amount }
        }
      }
      return out
    }

    const price = await stripe.prices.retrieve(STRIPE_PRICE_PRO, {
      expand: ['currency_options'],
    })

    // Prețul anual (opțional) — îl includem doar dacă e configurat și valid,
    // ca să nu blocăm afișarea prețului lunar dacă anualul lipsește.
    let annual: { interval: string; currencies: Record<string, { amount: number }> } | undefined
    if (STRIPE_PRICE_PRO_ANNUAL) {
      try {
        const annualPrice = await stripe.prices.retrieve(STRIPE_PRICE_PRO_ANNUAL, {
          expand: ['currency_options'],
        })
        annual = {
          interval: annualPrice.recurring?.interval ?? 'year',
          currencies: currenciesOf(annualPrice),
        }
      } catch (e) {
        console.error('get-plan-price: prețul anual nu a putut fi citit', e)
      }
    }

    return json({
      configured: true,
      interval: price.recurring?.interval ?? 'month',
      currencies: currenciesOf(price), // ex: { ron: { amount: 4999 }, eur: { amount: 999 } }
      ...(annual ? { annual } : {}),    // ex: { interval: 'year', currencies: { eur: { amount: 10000 } } }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('get-plan-price error:', message)
    // Nu blocăm UI-ul pentru o eroare de preț — semnalăm „neconfigurat".
    return json({ configured: false, error: message }, 200)
  }
})
