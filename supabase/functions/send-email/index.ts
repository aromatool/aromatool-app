import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret pentru semnarea linkului de dezabonare; același ca în funcția
// `unsubscribe`. Fallback pe CRON_SECRET ca să nu adăugăm un secret nou.
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''
// URL-ul appului (Vercel). Linkul VIZIBIL de dezabonare arată spre pagina
// /unsubscribe din app, care se randează corect (vezi nota de mai jos).
const APP_URL = (Deno.env.get('APP_URL') || 'https://app.aromatool.com').replace(/\/$/, '')

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

// URL one-click (List-Unsubscribe, RFC 8058). Clienții de mail fac POST aici
// fără să randeze HTML → rămâne pe funcția Supabase (endpoint real, nu SPA).
function unsubUrl(contactId: string, token: string): string {
  return `${SUPABASE_URL}/functions/v1/unsubscribe?c=${contactId}&t=${token}`
}

// URL VIZIBIL (linkul pe care-l apasă omul din footer). Arată spre pagina
// /unsubscribe din app — gateway-ul *.supabase.co rescrie text/html→text/plain,
// deci pagina funcției s-ar afișa ca text brut. Pagina din app se randează ok.
function unsubHumanUrl(contactId: string, token: string): string {
  return `${APP_URL}/unsubscribe?c=${contactId}&t=${token}`
}

// Footer HTML cu linkul de dezabonare, inserat înainte de </body>.
function injectUnsubFooter(html: string, link: string): string {
  const footer = `<div style="margin-top:8px;padding:18px 28px 28px;font-size:11px;color:#A89888;text-align:center;font-family:sans-serif;line-height:1.6">Nu mai vrei aceste emailuri? <a href="${link}" style="color:#A89888;text-decoration:underline">Dezabonează-te</a>.</div>`
  return html.includes('</body>')
    ? html.replace('</body>', `${footer}</body>`)
    : html + footer
}

// Echivalentul în text/plain al footerului de dezabonare.
function injectUnsubText(text: string, link: string): string {
  return `${text}\n\n—\nNu mai vrei aceste emailuri? Dezabonează-te: ${link}`
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

// ── RATE-LIMIT (H1): plafoane generoase pentru uz legitim, dar care opresc
// abuzul (trimiteri în masă prin infrastructura noastră Resend). ──
const RATE_LIMIT_HOUR = 40
const RATE_LIMIT_DAY = 300

// ── ACCES (H2): replică server-side a regulii din src/lib/subscription.tsx.
// hasAccess = is_admin || free_access || subscription_status==='active'
//             || (trial valid: trial_ends_at în viitor)
function computeHasAccess(p: {
  is_admin?: boolean | null
  free_access?: boolean | null
  subscription_status?: string | null
  trial_ends_at?: string | null
}): boolean {
  if (p.is_admin) return true
  if (p.free_access) return true
  if (p.subscription_status === 'active') return true
  if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now()) return true
  return false
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
    const { to, subject, html, text, contact_id, log_id, from_name, reply_to } = await req.json()

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

    // ── GATE DE ACCES (H2) ───────────────────────────────────
    // Trimiterea de email costă infrastructură reală (Resend) → o permitem
    // doar conturilor cu acces: admin, free_access, abonament activ sau trial
    // valid. Replică server-side a regulii din UI (nu te poți baza pe client).
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, free_access, subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single()

    if (!profile || !computeHasAccess(profile)) {
      return json({ error: 'Abonament necesar pentru a trimite emailuri.' }, 402)
    }

    // ── RATE-LIMIT (H1) ──────────────────────────────────────
    const nowMs = Date.now()
    const hourAgo = new Date(nowMs - 60 * 60 * 1000).toISOString()
    const dayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()

    const { count: hourCount } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('sent_at', hourAgo)
    if ((hourCount ?? 0) >= RATE_LIMIT_HOUR) {
      return json({ error: 'Ai atins limita de emailuri pe oră. Încearcă mai târziu.' }, 429)
    }

    const { count: dayCount } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('sent_at', dayAgo)
    if ((dayCount ?? 0) >= RATE_LIMIT_DAY) {
      return json({ error: 'Ai atins limita de emailuri pe zi. Încearcă mâine.' }, 429)
    }

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
    let finalText = typeof text === 'string' && text.trim() ? text : undefined
    let unsubHeaders: Record<string, string> = {}
    if (contact_id && UNSUB_SECRET) {
      const token = await signUnsub(contact_id)
      const humanLink = unsubHumanUrl(contact_id, token)   // footer vizibil → app
      const oneClickLink = unsubUrl(contact_id, token)     // header → funcție
      finalHtml = injectUnsubFooter(html, humanLink)
      if (finalText) finalText = injectUnsubText(finalText, humanLink)
      unsubHeaders = {
        'List-Unsubscribe': `<${oneClickLink}>`,
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
    // text/plain alături de HTML → multipart/alternative (mai bună livrabilitate).
    if (finalText) payload.text = finalText
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

    // Înregistrează trimiterea pentru rate-limiting (H1). Nu blocăm răspunsul
    // dacă logarea eșuează — emailul a plecat deja cu succes.
    await supabase
      .from('email_send_log')
      .insert({ user_id: user.id })
      .then(({ error }) => {
        if (error) console.error('email_send_log insert error:', error.message)
      })

    return json({ success: true, id: data.id })

  } catch (error) {
    console.error('Edge function error:', error)
    return json({ error: error.message }, 500)
  }
})
