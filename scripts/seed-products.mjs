#!/usr/bin/env node
// Seed/bulk-import catalog Young Living direct din fișierul local products.json
// (răspunsul brut al API-ului YL) în Supabase, prin RPC `import_yl_products`.
//
// Folosește ACEEAȘI logică de filtrare/mapare ca Edge Function `import-products`,
// dar rulează local — util pentru încărcarea inițială fără să aștepți API-ul live.
//
// Rulare:
//   SUPABASE_URL=https://kbtstoqrukxwnhpuvglv.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   node scripts/seed-products.mjs [cale/catre/products.json]
//
// ⚠️ Service role key = secret. Nu îl pune în cod și nu îl comite.
//    Setează-l în mediu (env) DOAR pentru rularea acestui script.

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COUNTRY = process.env.COUNTRY ?? 'RO'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '✗ Lipsesc variabilele de mediu SUPABASE_URL și/sau SUPABASE_SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

// Cale fișier: arg CLI sau implicit ../products.json (lângă folderul aromatool-app)
const __dirname = dirname(fileURLToPath(import.meta.url))
const jsonPath = resolve(
  __dirname,
  '..',
  process.argv[2] ?? '../products.json',
)

console.log(`→ Citesc catalogul din: ${jsonPath}`)

let raw
try {
  raw = JSON.parse(await readFile(jsonPath, 'utf8'))
} catch (e) {
  console.error(`✗ Nu pot citi/parsa fișierul: ${e.message}`)
  process.exit(1)
}

const items = Array.isArray(raw?.items) ? raw.items : []
const total = items.length
console.log(`→ ${total} produse brute în feed.`)

// Filtrare + mapare identice cu Edge Function:
// catalog vandabil = se poate cumpăra (canPurchase) + NU NFR + preț > 0 + partNumber.
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
    points: Number(it.pointValue ?? it.loyaltyPoints ?? 0) / 100,
    price_eur: Number(it.wholesaleDisplayPrice) / 100,
  }))
  .filter((p) => p.name && p.sku)

console.log(`→ ${mapped.length} produse după filtrare (NFR/preț/sku).`)

if (mapped.length === 0) {
  console.error('✗ Nimic de importat. Verifică structura fișierului.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Compania țintă (slug în tabela companies)
const COMPANY_SLUG = process.env.COMPANY_SLUG ?? 'young-living'
const { data: companyRow, error: cErr } = await supabase
  .from('companies')
  .select('id')
  .eq('slug', COMPANY_SLUG)
  .single()
if (cErr || !companyRow) {
  console.error(`✗ Compania "${COMPANY_SLUG}" nu există: ${cErr?.message ?? ''}`)
  process.exit(1)
}

console.log(`→ Apelez RPC import_company_products (${COMPANY_SLUG}, țara: ${COUNTRY})...`)
const { data, error } = await supabase.rpc('import_company_products', {
  p_company: companyRow.id,
  p_country: COUNTRY,
  p_items: mapped,
})

if (error) {
  console.error(`✗ Eroare RPC: ${error.message}`)
  process.exit(1)
}

const imported = data?.imported ?? mapped.length
const deactivated = data?.deactivated ?? 0
const skipped = total - mapped.length

console.log('✓ Import gata:')
console.log(`   • importate/actualizate : ${imported}`)
console.log(`   • dezactivate (dispărute): ${deactivated}`)
console.log(`   • ignorate (NFR/fără preț): ${skipped}`)
