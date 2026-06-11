import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret partajat pentru rulările din cron (setat ca secret al funcției).
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Baza endpoint-ului catalog Young Living (override-abilă prin secret).
// URL final = {base}/{culture}/{country}/2.
const YL_CATALOG_BASE =
  Deno.env.get('YL_CATALOG_BASE') ??
  'https://www.youngliving.com/api/shopping/product-catalog'
// Override COMPLET pentru RO/cron (compat înapoi). Ignorat dacă requestul
// trimite explicit o țară (import multi-țară din Admin).
const YL_CATALOG_URL_OVERRIDE = Deno.env.get('YL_CATALOG_URL') ?? ''
// Compania pentru care rulează acest importer (slug în tabela companies).
const COMPANY_SLUG = 'young-living'

// Țări suportate (zona EUR) + cultura folosită la fetch.
// ⚠️ Cultura determină LIMBA numelor, independent de țară (care dă prețul).
// Pentru unele țări YL NU are traduceri în limba locală și întoarce numele
// gol (it-IT, fr-BE/nl-BE, en-IE, pt-PT → toate goale). Pentru ele folosim
// `en-GB` ca fallback (umple numele, prețul rămâne al țării respective).
// Numele YL sunt oricum brand-uri ("Thieves") + variantă ("15 ml").
// Requestul poate trimite explicit `culture` ca să suprascrie.
const CULTURE_BY_COUNTRY: Record<string, string> = {
  RO: 'ro-RO',
  DE: 'de-DE',
  FR: 'fr-FR',
  IT: 'en-GB', // it-IT → nume goale
  ES: 'es-ES',
  NL: 'nl-NL',
  BE: 'en-GB', // fr-BE / nl-BE → nume goale
  AT: 'de-AT',
  IE: 'en-GB', // en-IE → nume goale
  PT: 'en-GB', // pt-PT → nume goale
  FI: 'fi-FI',
  GB: 'en-GB', // UK — prețuri în GBP (vezi moneda din răspuns)
  MD: 'ro-RO', // Moldova — prețuri fără TVA (0%), nume în română
  UA: 'en-GB', // Ucraina — prețuri fără TVA (0%), nume în engleză
}

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
  // YL trimite moneda fie ca string ("GBP"), fie ca obiect { code, symbol }.
  currency?: string | { code?: string; symbol?: string }
}

// Moneda implicită per țară (fallback dacă răspunsul YL nu o expune).
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  RO: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR',
  GB: 'GBP',
  MD: 'EUR', UA: 'EUR',
}

function extractCurrency(it: YlItem): string | null {
  const c = it.currency
  if (!c) return null
  if (typeof c === 'string') return c.trim().toUpperCase() || null
  return (c.code ?? '').trim().toUpperCase() || null
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

  // ── ȚARA țintă (din body; default RO pentru cron/compat) ─────
  let reqBody: { country?: string; culture?: string } = {}
  try {
    const txt = await req.text()
    if (txt) reqBody = JSON.parse(txt)
  } catch {
    // fără body / body invalid → import RO implicit
  }

  const country = (reqBody.country ?? 'RO').toUpperCase()
  if (!CULTURE_BY_COUNTRY[country]) {
    return json({ error: `Țară nesuportată: ${country}` }, 400)
  }
  const culture = reqBody.culture ?? CULTURE_BY_COUNTRY[country]
  // URL-ul: override-ul din env se folosește DOAR pentru RO/cron (fără țară
  // explicită); altfel construim dinamic din cultură + țară.
  const catalogUrl =
    YL_CATALOG_URL_OVERRIDE && !reqBody.country
      ? YL_CATALOG_URL_OVERRIDE
      : `${YL_CATALOG_BASE}/${culture}/${country}/2`

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
      source_url: catalogUrl,
      country_code: country,
    })
    .select('id')
    .single()
  const jobId = job?.id as string | undefined

  try {
    // ── FETCH CATALOG YL ──────────────────────────────────────
    const resp = await fetch(catalogUrl, {
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
    const sellable = items.filter(
      (it) =>
        it &&
        it.canPurchase === true &&
        it.isNFR === false &&
        Number(it.wholesaleDisplayPrice) > 0 &&
        !!it.partNumber,
    )

    const mapped = sellable
      .map((it) => ({
        name: String(it.name ?? '').trim(),
        sku: String(it.partNumber).trim(),
        // YL trimite punctele și prețul ×100 (ex: 12220 = 122.20)
        points: Number(it.pointValue ?? it.loyaltyPoints ?? 0) / 100,
        price_eur: Number(it.wholesaleDisplayPrice) / 100,
      }))
      .filter((p) => p.name && p.sku)

    // Moneda catalogului: din răspunsul YL (primul item cu monedă),
    // altfel fallback pe maparea per țară (GB → GBP, restul → EUR).
    const currency =
      sellable.map(extractCurrency).find((c) => !!c) ??
      CURRENCY_BY_COUNTRY[country] ??
      'EUR'

    // Gardă: dacă majoritatea produselor vandabile au numele gol, cultura
    // aleasă nu are traduceri pentru această țară (ex: it-IT, fr-BE, pt-PT).
    // Mai bine oprim importul decât să salvăm un catalog fără nume.
    if (sellable.length > 0 && mapped.length < sellable.length * 0.5) {
      throw new Error(
        `Cultura "${culture}" nu are nume pentru ${country} ` +
          `(${mapped.length}/${sellable.length} produse cu nume). ` +
          `Încearcă altă cultură (ex: en-GB).`,
      )
    }

    // ── UPSERT + DEZACTIVARE prin RPC (logica e în SQL) ───────
    const { data: result, error: rpcErr } = await supabase.rpc(
      'import_company_products',
      {
        p_company: companyId,
        p_country: country,
        p_items: mapped,
        p_currency: currency,
      },
    )
    if (rpcErr) {
      // PostgrestError e un obiect; păstrăm detaliile ca text lizibil.
      throw new Error(
        rpcErr.message ||
          [rpcErr.code, rpcErr.details, rpcErr.hint].filter(Boolean).join(' · ') ||
          JSON.stringify(rpcErr),
      )
    }

    const imported = (result?.imported as number) ?? mapped.length
    const created = (result?.new as number) ?? 0
    const updated = (result?.updated as number) ?? 0
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
          records_new: created,
          records_updated: updated,
          records_deactivated: deactivated,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    return json({
      ok: true,
      country,
      currency,
      total,
      imported,
      new: created,
      updated,
      deactivated,
      skipped,
    })
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === 'object'
          ? JSON.stringify(e)
          : String(e)
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
