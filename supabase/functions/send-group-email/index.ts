import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// SEND-GROUP-EMAIL — trimitere „în grup" către PROPRIILE contacte
// ale utilizatorului (mesaj de informare / ofertă, cu poză inline).
//
// IMPORTANT: funcție SEPARATĂ de `send-email` (cea de care depind
// confirmările de înscriere). Aici NU se modifică nimic din fluxul
// transacțional — doar adăugăm o cale nouă, izolată.
//
// Siguranță:
//   • doar utilizatori cu acces (admin / free / abonament / trial)
//   • destinatarii = DOAR contactele userului autentificat (user_id),
//     emailul real e citit din DB (nu de la client)
//   • exclude email_opt_out + communication_blocked
//   • pauză între trimiteri (anti rate-limit Resend) + retry la 429
//   • injectează footer + header List-Unsubscribe per contact
//   • plafon per-apel + plafon zilnic (anti-abuz)
//
// Body:
//   { contactIds: string[], subject, html, text?, from_name?, reply_to? }
//   { testEmailToSelf: true, subject, html, text?, from_name?, reply_to? }
//      → trimite O singură probă la emailul contului (fără contacte)
//
// Personalizare: dacă HTML/textul conțin „__PRENUME__", e înlocuit
// per destinatar cu prenumele contactului (fallback gol → curățat).
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''
const APP_URL = (Deno.env.get('APP_URL') || 'https://getaromatool.com').replace(/\/$/, '')
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'

// Pauză între trimiteri ca să rămânem sub limita Resend (~2/sec).
const SEND_DELAY_MS = Number(Deno.env.get('SEND_DELAY_MS')) || 650
// Plafoane anti-abuz pentru trimiterea în grup.
const MAX_PER_CALL = 500
const GROUP_DAILY_LIMIT = 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Acces (replică server-side a regulii din UI) ─────────────
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

// ── Dezabonare (identic cu funcția send-email / unsubscribe) ──
async function signUnsub(contactId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(contactId))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const unsubUrl = (id: string, t: string) => `${SUPABASE_URL}/functions/v1/unsubscribe?c=${id}&t=${t}`
const unsubHumanUrl = (id: string, t: string) => `${APP_URL}/unsubscribe?c=${id}&t=${t}`

function injectUnsubFooter(html: string, link: string): string {
  const footer = `<div style="margin-top:8px;padding:18px 28px 28px;font-size:11px;color:#A89888;text-align:center;font-family:sans-serif;line-height:1.6">Nu mai vrei aceste emailuri? <a href="${link}" style="color:#A89888;text-decoration:underline">Dezabonează-te</a>.</div>`
  return html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer
}
function injectUnsubText(text: string, link: string): string {
  return `${text}\n\n—\nNu mai vrei aceste emailuri? Dezabonează-te: ${link}`
}

// ── Header „From" ────────────────────────────────────────────
function sanitizeName(name?: string): string {
  return name ? name.replace(/[<>"\r\n]/g, '').trim().slice(0, 80) : ''
}
function encodeName(name: string): string {
  if (/^[\x20-\x7E]*$/.test(name)) return `"${name}"`
  const bytes = new TextEncoder().encode(name)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `=?UTF-8?B?${btoa(bin)}?=`
}
function buildFrom(fromName?: string): string {
  const clean = sanitizeName(fromName)
  return clean ? `${encodeName(clean)} <${MAIL_FROM}>` : `AromaTool <${MAIL_FROM}>`
}
function validReplyTo(email?: string): string | undefined {
  if (!email) return undefined
  const e = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined
}
function sanitizeSubject(subject: string): string {
  return (subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
}
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

function firstName(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || ''
}

// Personalizare per destinatar:
//   __PRENUME__ → salut („ Maria" sau gol) — folosit la antet.
//   __FN__      → prenume simplu inline (subiect/titlu/mesaj), gol dacă lipsește.
function applyName(s: string, fn: string): string {
  return s.replaceAll('__PRENUME__', fn ? ` ${fn}` : '').replaceAll('__FN__', fn)
}

// Trimitere Resend cu retry la 429.
async function resendSend(payload: Record<string, unknown>, attempt = 0): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1
    await sleep(Math.max(retryAfter * 1000, 1000))
    return resendSend(payload, attempt + 1)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `Resend ${res.status}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const {
      contactIds, subject, html, text, from_name, reply_to, testEmailToSelf,
    } = await req.json()

    if (!subject || !html) return json({ error: 'Missing required fields: subject, html' }, 400)
    if (!RESEND_API_KEY) return json({ error: 'missing_resend_key' }, 500)

    // ── AUTENTIFICARE ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    // ── GATE DE ACCES ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, free_access, subscription_status, trial_ends_at')
      .eq('id', user.id)
      .single()
    if (!profile || !computeHasAccess(profile)) {
      return json({ error: 'Abonament necesar pentru a trimite emailuri.' }, 402)
    }

    const rt = validReplyTo(reply_to)
    const fromHeader = buildFrom(from_name)
    const cleanSubject = sanitizeSubject(subject)

    // ── PROBĂ către sine (demo / verificare) — fără contacte ──
    if (testEmailToSelf) {
      const selfEmail = (user.email || '').trim()
      if (!isValidEmail(selfEmail)) return json({ error: 'Contul nu are un email valid.' }, 400)
      // Proba e mai grăitoare dacă apare chiar numele celui care testează.
      const selfFn = firstName(
        (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined,
      )
      const personalizedHtml = applyName(String(html), selfFn)
      const personalizedText = typeof text === 'string' ? applyName(text, selfFn) : undefined
      const personalizedSubject = applyName(cleanSubject, selfFn)
      const payload: Record<string, unknown> = {
        from: fromHeader, to: selfEmail, subject: personalizedSubject, html: personalizedHtml,
      }
      if (personalizedText) payload.text = personalizedText
      if (rt) payload.reply_to = rt
      try {
        await resendSend(payload)
        return json({ ok: true, mode: 'test', to: selfEmail })
      } catch (e) {
        return json({ ok: false, mode: 'test', error: e instanceof Error ? e.message : String(e) }, 500)
      }
    }

    // ── TRIMITERE ÎN GRUP ──
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return json({ error: 'Niciun destinatar selectat.' }, 400)
    }
    if (contactIds.length > MAX_PER_CALL) {
      return json({ error: `Prea mulți destinatari într-o trimitere (max ${MAX_PER_CALL}).` }, 400)
    }

    // Plafon zilnic anti-abuz (numără din email_send_log pe ultimele 24h).
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dayCount } = await supabase
      .from('email_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('sent_at', dayAgo)
    if ((dayCount ?? 0) + contactIds.length > GROUP_DAILY_LIMIT) {
      return json({ error: 'Ai atins limita de emailuri pe zi. Încearcă mâine.' }, 429)
    }

    // Destinatarii REALI: doar contactele userului, fără opt-out / blocați.
    const { data: contacts, error: cErr } = await supabase
      .from('contacts')
      .select('id, name, email, email_opt_out, communication_blocked')
      .eq('user_id', user.id)
      .in('id', contactIds)
    if (cErr) return json({ error: cErr.message }, 500)

    const eligible = (contacts ?? []).filter(
      (c) => !c.email_opt_out && !c.communication_blocked && c.email && isValidEmail(String(c.email).trim()),
    )

    let sent = 0, failed = 0
    const skipped = (contacts ?? []).length - eligible.length
    const errors: { email: string; error: string }[] = []

    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i]
      const recipient = String(c.email).trim()
      try {
        // Personalizare prenume (antet + inline în subiect/titlu/mesaj).
        const fn = firstName(c.name)
        let finalHtml = applyName(String(html), fn)
        let finalText = typeof text === 'string' && text.trim()
          ? applyName(text, fn)
          : undefined
        const finalSubject = applyName(cleanSubject, fn)

        // Dezabonare per contact.
        let unsubHeaders: Record<string, string> = {}
        if (UNSUB_SECRET) {
          const t = await signUnsub(c.id)
          finalHtml = injectUnsubFooter(finalHtml, unsubHumanUrl(c.id, t))
          if (finalText) finalText = injectUnsubText(finalText, unsubHumanUrl(c.id, t))
          unsubHeaders = {
            'List-Unsubscribe': `<${unsubUrl(c.id, t)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        }

        const payload: Record<string, unknown> = {
          from: fromHeader, to: recipient, subject: finalSubject, html: finalHtml,
        }
        if (finalText) payload.text = finalText
        if (Object.keys(unsubHeaders).length) payload.headers = unsubHeaders
        if (rt) payload.reply_to = rt

        await resendSend(payload)
        sent++
        // Log pentru consum (cardul din Admin) + activitate pe contact.
        await supabase.from('email_send_log').insert({ user_id: user.id })
        await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', c.id)
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`send-group-email: eșec pentru ${recipient}: ${msg}`)
        errors.push({ email: recipient, error: msg })
      }
      if (i < eligible.length - 1) await sleep(SEND_DELAY_MS)
    }

    return json({ ok: true, mode: 'group', requested: contactIds.length, sent, failed, skipped, errors })
  } catch (error) {
    console.error('send-group-email error:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
