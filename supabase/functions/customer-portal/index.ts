import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

// ============================================================
// CUSTOMER PORTAL — deschide portalul Stripe pentru ca userul
// să-și gestioneze abonamentul (card, facturi, anulare).
// Necesită activarea portalului în Stripe Dashboard → Settings →
// Billing → Customer portal.
// ============================================================

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY         = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const APP_URL                   = Deno.env.get('APP_URL') ?? ''

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

    // ── Auth ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    // ── Customer ─────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    const customerId = profile?.stripe_customer_id as string | null
    if (!customerId) {
      return json({ error: 'Nu există un abonament de gestionat.' }, 400)
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const base = APP_URL || new URL(req.url).origin
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/app/settings`,
    })

    return json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('customer-portal error:', message)
    return json({ error: message }, 500)
  }
})
