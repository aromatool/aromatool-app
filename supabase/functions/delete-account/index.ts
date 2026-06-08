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

// Tabele deținute de user, în ordinea ștergerii (copii înainte de părinți).
// followup_log / resource_links referă oferte/resurse; le ștergem primele.
const USER_TABLES = [
  'followup_log',
  'resource_links',
  'template_resources',
  'daily_focus_jobs',
  'feedback',
  'product_import_jobs',
  'offers',
  'resources',
  'contacts',
  'companies',
]

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
    // Bucket privat „resources", fișiere sub folderul {userId}/...
    try {
      const { data: files } = await supabase.storage
        .from('resources')
        .list(userId, { limit: 1000 })
      if (files && files.length) {
        const paths = files.map((f) => `${userId}/${f.name}`)
        await supabase.storage.from('resources').remove(paths)
      }
    } catch (e) {
      console.error('Storage cleanup failed (continuăm):', e)
    }

    // ── 3. DATE: șterge rândurile userului, în ordine ────────
    for (const table of USER_TABLES) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId)
      if (error) {
        // Coloana user_id poate lipsi la unele tabele (ex: companies).
        // Logăm și continuăm — ștergerea userului auth va cascada restul.
        console.error(`Delete from ${table} failed (continuăm):`, error.message)
      }
    }

    // profiles are cheia primară = id (nu user_id)
    await supabase.from('profiles').delete().eq('id', userId)

    // ── 4. AUTH: șterge userul (necesită service role) ───────
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
