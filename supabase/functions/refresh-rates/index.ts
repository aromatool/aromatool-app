// ============================================================
// C1: refresh-rates — actualizează tabelul public.exchange_rates
// din https://api.frankfurter.app (rulat zilnic din pg_cron).
// ============================================================
// Auth:
//   • cron  → header x-cron-secret == CRON_SECRET
//   • admin → JWT (Bearer) al unui user cu rol admin (pentru test manual)
// Scrie cu service_role (bypass RLS). Frontend-ul doar citește tabelul.
// ============================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

// Valutele pe care le urmărim (EUR e baza, implicit 1).
const CURRENCIES = ['RON', 'USD', 'GBP', 'CHF', 'HUF', 'PLN', 'CZK']
const FRANKFURTER_URL =
  `https://api.frankfurter.app/latest?from=EUR&to=${CURRENCIES.join(',')}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── AUTENTIFICARE: cron (secret) sau admin (JWT) ──
  const cronSecret = req.headers.get('x-cron-secret')
  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    // rulare din cron — ok
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    const { data: isAdmin } = await supabase.rpc('is_admin')
    if (!isAdmin) return json({ error: 'Forbidden' }, 403)
  }

  // ── FETCH cursuri ──
  let payload: { date?: string; rates?: Record<string, number> }
  try {
    const res = await fetch(FRANKFURTER_URL)
    if (!res.ok) throw new Error(`frankfurter ${res.status}`)
    payload = await res.json()
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e) }, 502)
  }

  const rates = payload.rates || {}
  const now = new Date().toISOString()
  // Schema tabelului e pe perechi (from_currency, to_currency). Scriem
  // perechile EUR→valută (= reprezentarea „per EUR" citită de frontend).
  const rows: { from_currency: string; to_currency: string; rate: number; updated_at: string }[] = [
    { from_currency: 'EUR', to_currency: 'EUR', rate: 1, updated_at: now },
  ]
  for (const c of CURRENCIES) {
    const r = rates[c]
    // Sanity check: număr finit > 0. Sărim valuta dacă API-ul a returnat junk.
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) {
      rows.push({ from_currency: 'EUR', to_currency: c, rate: r, updated_at: now })
    }
  }

  if (rows.length <= 1) {
    return json({ error: 'no_valid_rates', payload }, 502)
  }

  const { error } = await supabase
    .from('exchange_rates')
    .upsert(rows, { onConflict: 'from_currency,to_currency' })

  if (error) return json({ error: 'db_upsert_failed', detail: error.message }, 500)

  return json({ ok: true, updated: rows.length, date: payload.date ?? null })
})
