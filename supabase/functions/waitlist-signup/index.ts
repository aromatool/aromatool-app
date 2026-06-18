import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// WAITLIST SIGNUP — endpoint PUBLIC pentru pagina coming-soon.
// Primește un email + consimțământ, îl salvează (deduplicat) în
// tabela `waitlist`. Luni, funcția `waitlist-launch` trimite codul.
//
// Public: deploy cu `--no-verify-jwt` (ca `unsubscribe`). Nu cere
// niciun secret — e doar o adresă de email lăsată voluntar.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validare email simplă, dar suficientă (RFC complet e exagerat aici).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { email?: string; consent?: boolean; source?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body invalid' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'invalid_email' }, 400)
  }
  // Consimțământ explicit obligatoriu (GDPR — colectare pentru marketing).
  if (body.consent !== true) {
    return json({ error: 'consent_required' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Upsert idempotent: dacă emailul există deja, nu eroare, nu duplicat.
  // Nu dezvăluim dacă emailul era deja înscris (privacy + UX curat).
  const { error } = await supabase
    .from('waitlist')
    .upsert(
      {
        email,
        consent: true,
        source: String(body.source ?? 'coming_soon').slice(0, 60),
        user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
      },
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    return json({ error: 'save_failed', detail: error.message }, 500)
  }

  return json({ ok: true })
})
