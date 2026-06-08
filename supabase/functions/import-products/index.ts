import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret partajat pentru rulările din cron (setat ca secret al funcției).
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Endpoint catalog Young Living (override-abil prin secret dacă se schimbă).
const YL_CATALOG_URL =
  Deno.env.get('YL_CATALOG_URL') ??
  'https://www.youngliving.com/api/shopping/product-catalog/ro-RO/RO/2'
const COUNTRY = 'RO'
// Compania pentru care rulează acest importer (slug în tabela companies).
const COMPANY_SLUG = 'young-living'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

interface YlItem {
  name?: string
  partNumber?: string
  pointValue?: number
  loyaltyPoints?: number
  wholesaleDisplayPrice?: number
  isNFR?: boolean
  canPurchase?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── COMPANIE țintă ──────────────────────────────────────────
  const { data: companyRow } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', COMPANY_SLUG)
    .single()
  const companyId = companyRow?.id as string | undefined
  if (!companyId) {
    return json({ error: `Compania "${COMPANY_SLUG}" nu există.` }, 500)
  }

  // ── AUTENTIFICARE: admin (JWT) sau cron (secret) ─────────────
  let triggeredBy: string | null = null
  const cronSecret = req.headers.get('x-cron-secret')

  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    // rulare din cron — permisă
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return json({ error: 'Doar administratorii pot importa produse.' }, 403)
    }
    triggeredBy = user.id
  }

  // ── CREARE JOB ───────────────────────────────────────────────
  const { data: job } = await supabase
    .from('product_import_jobs')
    .insert({
      triggered_by: triggeredBy,
      status: 'running',
      source_url: YL_CATALOG_URL,
      country_code: COUNTRY,
    })
    .select('id')
    .single()
  const jobId = job?.id as string | undefined

  try {
    // ── FETCH CATALOG YL ──────────────────────────────────────
    const resp = await fetch(YL_CATALOG_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; AromaTool/1.0; +https://aromatool-app.vercel.app)',
      },
    })
    if (!resp.ok) {
      throw new Error(`API Young Living a răspuns ${resp.status} ${resp.statusText}`)
    }
    const data = await resp.json()
    const items: YlItem[] = Array.isArray(data?.items) ? data.items : []
    const total = items.length
    if (total === 0) {
      throw new Error('Răspunsul API nu conține produse (items gol).')
    }

    // ── FILTRARE + MAPARE ─────────────────────────────────────
    // Catalog vandabil = produse care se pot cumpăra acum (canPurchase),
    // nu sunt NFR și au preț > 0. (~700 produse, nu tot catalogul de 3100.)
    const mapped = items
      .filter(
        (it) =>
          it &&
          it.canPurchase === true &&
          it.isNFR === false &&
          Number(it.wholesaleDisplayPrice) > 0 &&
          !!it.partNumber,
      )
      .map((it) => ({
        name: String(it.name ?? '').trim(),
        sku: String(it.partNumber).trim(),
        // YL trimite punctele și prețul ×100 (ex: 12220 = 122.20 €)
        points: Number(it.pointValue ?? it.loyaltyPoints ?? 0) / 100,
        price_eur: Number(it.wholesaleDisplayPrice) / 100,
      }))
      .filter((p) => p.name && p.sku)

    // ── UPSERT + DEZACTIVARE prin RPC (logica e în SQL) ───────
    const { data: result, error: rpcErr } = await supabase.rpc(
      'import_company_products',
      { p_company: companyId, p_country: COUNTRY, p_items: mapped },
    )
    if (rpcErr) throw rpcErr

    const imported = (result?.imported as number) ?? mapped.length
    const deactivated = (result?.deactivated as number) ?? 0
    const skipped = total - mapped.length

    if (jobId) {
      await supabase
        .from('product_import_jobs')
        .update({
          status: 'done',
          records_total: total,
          records_imported: imported,
          records_failed: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    return json({ ok: true, total, imported, deactivated, skipped })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (jobId) {
      await supabase
        .from('product_import_jobs')
        .update({
          status: 'failed',
          error_log: { message: msg },
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }
    return json({ error: msg }, 500)
  }
})
