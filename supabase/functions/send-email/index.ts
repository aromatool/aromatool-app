import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'AromaTool <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { to, subject, html, contact_id, log_id } = await req.json()

    if (!to || !subject || !html) {
      return json({ error: 'Missing required fields: to, subject, html' }, 400)
    }

    // ── AUTENTIFICARE ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    // ── VERIFICARE DESTINATAR ────────────────────────────────
    // Dacă contact_id e furnizat, verifică că aparține userului.
    // Previne trimiterea de emailuri prin infrastructura noastră
    // către adrese care nu sunt contactele userului autentificat.
    if (contact_id) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, email_opt_out, communication_blocked')
        .eq('id', contact_id)
        .eq('user_id', user.id)
        .single()

      if (!contact) {
        return json({ error: 'Contact not found or access denied' }, 403)
      }

      // ── COMMUNICATION CONTROLS ───────────────────────────────
      if (contact.communication_blocked) {
        return json({ error: 'Comunicarea este blocată pentru acest contact.' }, 403)
      }
      if (contact.email_opt_out) {
        return json({ error: 'Emailul este dezactivat pentru acest contact.' }, 403)
      }
    }

    // ── TRIMITERE EMAIL ──────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)

      // Loghează eroarea dacă avem un log_id din followup_log
      if (log_id) {
        await supabase
          .from('followup_log')
          .update({ status: 'failed' })
          .eq('id', log_id)
          .eq('user_id', user.id)  // RLS extra safety
      }

      return json({ error: data.message || 'Failed to send email' }, res.status)
    }

    return json({ success: true, id: data.id })

  } catch (error) {
    console.error('Edge function error:', error)
    return json({ error: error.message }, 500)
  }
})
