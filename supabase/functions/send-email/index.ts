import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret pentru semnarea linkului de dezabonare; același ca în funcția
// `unsubscribe`. Fallback pe CRON_SECRET ca să nu adăugăm un secret nou.
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''

// HMAC-SHA256(contactId) → hex. Identic cu funcția `unsubscribe`.
async function signUnsub(contactId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(contactId),
  )
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Construiește URL-ul de dezabonare pentru un contact.
function unsubUrl(contactId: string, token: string): string {
  return `${SUPABASE_URL}/functions/v1/unsubscribe?c=${contactId}&t=${token}`
}

// Footer HTML cu linkul de dezabonare, inserat înainte de </body>.
function injectUnsubFooter(html: string, link: string): string {
  const footer = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #EDE8E0;font-size:11px;color:#A89888;text-align:center;font-family:sans-serif">Nu mai vrei aceste emailuri? <a href="${link}" style="color:#A89888">Dezabonează-te</a>.</div>`
  return html.includes('</body>')
    ? html.replace('</body>', `${footer}</body>`)
    : html + footer
}

// Adresa tehnică de expediere. O singură dată verifici domeniul în Resend
// și setezi secretul MAIL_FROM (ex: "trimite@mail.aromatool.com"). Până atunci
// rămâne sandbox-ul de test Resend (merge doar către emailul tău verificat).
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'

// Curăță numele afișat de caractere care ar strica header-ul „From"
// (newline, ghilimele, paranteze unghiulare). Apoi îl punem între ghilimele.
function sanitizeName(name?: string): string {
  if (!name) return ''
  return name.replace(/[<>"\r\n]/g, '').trim().slice(0, 80)
}

// Construiește header-ul „From": "Nume utilizator <adresa-ta>".
function buildFrom(fromName?: string): string {
  const clean = sanitizeName(fromName)
  return clean ? `"${clean}" <${MAIL_FROM}>` : `AromaTool <${MAIL_FROM}>`
}

// Reply-To valid doar dacă pare un email (altfel îl ignorăm).
function validReplyTo(email?: string): string | undefined {
  if (!email) return undefined
  const e = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined
}

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
    const { to, subject, html, contact_id, log_id, from_name, reply_to } = await req.json()

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

    // ── DEZABONARE (conformitate email UE) ───────────────────
    // Dacă avem un contact, generăm link semnat + îl injectăm în HTML
    // și adăugăm header-ele List-Unsubscribe (cerute de Gmail/Yahoo).
    let finalHtml = html
    let unsubHeaders: Record<string, string> = {}
    if (contact_id && UNSUB_SECRET) {
      const token = await signUnsub(contact_id)
      const link = unsubUrl(contact_id, token)
      finalHtml = injectUnsubFooter(html, link)
      unsubHeaders = {
        'List-Unsubscribe': `<${link}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    }

    // ── TRIMITERE EMAIL ──────────────────────────────────────
    // From: numele utilizatorului pe domeniul nostru; Reply ajunge la el.
    const payload: Record<string, unknown> = {
      from: buildFrom(from_name),
      to,
      subject,
      html: finalHtml,
    }
    if (Object.keys(unsubHeaders).length) payload.headers = unsubHeaders
    const rt = validReplyTo(reply_to)
    if (rt) payload.reply_to = rt

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
