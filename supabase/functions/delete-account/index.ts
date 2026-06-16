import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// DELETE ACCOUNT — ștergere completă a contului (GDPR).
// Șterge defensiv, în ordine, datele userului din toate tabelele,
// fișierele din Storage, anulează abonamentul Stripe + șterge
// clientul Stripe, apoi șterge userul auth. Funcționează indiferent
// de regulile FK (nu se bazează pe cascade).
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tabele deținute de user, filtrate pe user_id, în ordinea ștergerii
// (copii înainte de părinți). followup_log / resource_links referă
// oferte/resurse; le ștergem primele. `contacts` vine ULTIMUL pentru că
// webhook_log se corelează pe contact_id (vezi purgeWebhookLog) și trebuie
// curățat înainte ca rândurile de contacte să dispară.
//
// NU includem aici:
//   • companies / daily_focus_jobs — tabele GLOBALE, fără coloană user_id
//     (companies = date partajate Young Living; ștergerea ar afecta alți useri).
//   • account_email_jobs — log de rulări global (monitorizare), fără user_id.
//   • webhook_log — fără user_id, se curăță separat pe contact_id.
//   • product_import_jobs — cheia e triggered_by (date admin), curățat separat.
const USER_TABLES = [
  'followup_log',
  'resource_links',
  'template_resources',
  // Șabloanele PROPRII ale userului (user_id = userId). Cele de sistem au
  // user_id NULL → nu sunt atinse de filtrul .eq('user_id', userId). Vine după
  // followup_log (care le referă cu RESTRICT) și template_resources (cascade).
  'followup_templates',
  'feedback',
  'email_send_log',
  'account_email_log',
  'offers',
  'resources',
  'contacts',
]

// Listează RECURSIV toate căile de fișiere dintr-un prefix de bucket.
// Storage Supabase nu are listare recursivă nativă: un item cu id === null
// este un „folder" (placeholder), pe care trebuie să-l descindem manual.
// deno-lint-ignore no-explicit-any
async function listAllFiles(supabase: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = []
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 })
  if (error || !items) return out
  for (const item of items) {
    const full = `${prefix}/${item.name}`
    if (item.id === null) {
      // Subfolder → coborâm recursiv.
      const nested = await listAllFiles(supabase, bucket, full)
      out.push(...nested)
    } else {
      out.push(full)
    }
  }
  return out
}

// webhook_log NU are user_id — păstrează `contact_id` și emailul contactului
// în `payload` (date personale ale unei terțe persoane). Îl curățăm corelat
// pe contactele userului, ÎNAINTE ca rândurile de contacte să fie șterse.
// Returnează un mesaj de eroare dacă ceva pică (pentru fail-loud), altfel null.
// deno-lint-ignore no-explicit-any
async function purgeWebhookLog(supabase: any, userId: string): Promise<string | null> {
  // 1) ID-urile contactelor userului.
  const { data: contacts, error: selErr } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
  if (selErr) return `webhook_log: nu am putut citi contactele: ${selErr.message}`
  const ids = (contacts ?? []).map((c: { id: string }) => c.id)
  if (ids.length === 0) return null

  // 2) Ștergem în batch-uri (lista IN poate fi mare).
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { error } = await supabase
      .from('webhook_log')
      .delete()
      .in('contact_id', batch)
    if (error) return `webhook_log: ${error.message}`
  }
  return null
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

  try {
    // ── AUTENTIFICARE ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const userId = user.id

    // Acumulăm erorile de ștergere a DATELOR (DB + Storage). Dacă rămâne ceva
    // ne-șters, NU mai ștergem userul auth — altfel am orfana date personale
    // imposibil de mai legat de cineva (încălcare „dreptul la ștergere").
    const errors: string[] = []

    // ── 1. STRIPE: anulează abonament + șterge clientul ──────
    // Best-effort: dacă pică, continuăm ștergerea (nu blocăm GDPR).
    if (STRIPE_SECRET_KEY) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', userId)
          .single()
        const customerId = profile?.stripe_customer_id as string | null
        if (customerId) {
          // Ștergerea clientului anulează automat abonamentele active.
          await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          })
        }
      } catch (e) {
        console.error('Stripe cleanup failed (continuăm):', e)
      }
    }

    // ── 2. STORAGE: șterge fișierele userului ────────────────
    // Bucket privat „resources". Layout real = {userId}/{resourceId}/{nume},
    // deci un singur .list(userId) NU vede fișierele (doar subfoldere).
    // Mergem recursiv: list returnează un „folder" când item.id === null.
    try {
      const allPaths = await listAllFiles(supabase, 'resources', userId)
      // Supabase remove acceptă ~max câteva sute de căi/cerere; batch-uim la 100.
      for (let i = 0; i < allPaths.length; i += 100) {
        const { error } = await supabase.storage
          .from('resources')
          .remove(allPaths.slice(i, i + 100))
        if (error) errors.push(`storage: ${error.message}`)
      }
    } catch (e) {
      errors.push(`storage: ${(e as Error).message}`)
    }

    // ── 3. WEBHOOK_LOG: curăță logul corelat pe contacte ─────
    // ÎNAINTE de ștergerea contactelor (se corelează pe contact_id).
    const whErr = await purgeWebhookLog(supabase, userId)
    if (whErr) errors.push(whErr)

    // ── 4. PRODUCT_IMPORT_JOBS: cheia e triggered_by (admin) ──
    {
      const { error } = await supabase
        .from('product_import_jobs')
        .delete()
        .eq('triggered_by', userId)
      if (error) errors.push(`product_import_jobs: ${error.message}`)
    }

    // ── 5. DATE: șterge rândurile userului, în ordine ────────
    for (const table of USER_TABLES) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId)
      if (error) errors.push(`${table}: ${error.message}`)
    }

    // profiles are cheia primară = id (nu user_id)
    {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) errors.push(`profiles: ${error.message}`)
    }

    // ── 6. GATE: nu ștergem userul auth dacă au rămas date ───
    // Returnăm 500 cu detaliile, ca operațiunea să poată fi reîncercată.
    if (errors.length > 0) {
      console.error('delete-account: ștergere incompletă, NU ștergem userul auth:', errors)
      return json({
        error: 'Nu am putut șterge complet datele contului. Reîncearcă sau contactează-ne.',
        details: errors,
      }, 500)
    }

    // ── 7. AUTH: șterge userul (necesită service role) ───────
    const { error: delErr } = await supabase.auth.admin.deleteUser(userId)
    if (delErr) {
      console.error('Auth deleteUser failed:', delErr.message)
      return json({ error: 'Nu am putut șterge contul complet. Contactează-ne.' }, 500)
    }

    return json({ success: true })
  } catch (error) {
    console.error('delete-account error:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
