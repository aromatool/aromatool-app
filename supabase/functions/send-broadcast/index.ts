import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// SEND-BROADCAST — „newsletter"/anunțuri către PROPRIII useri AromaTool
// (Brand Partners cu cont), declanșat din Admin.
//
// Diferă complet de send-group-email (acela = un user către CLIENȚII lui).
// Aici expeditorul e AromaTool (compania), destinatarii sunt userii app-ului.
//
// Siguranță:
//   • DOAR admin (JWT + is_admin)
//   • destinatarii = userii reali (auth.admin.listUsers), emailul din DB
//   • exclude product_emails_opt_out ȘI account_emails_opt_out
//     (o dezabonare puternică de la cont oprește și newsletterul)
//   • FROM = NEWS_MAIL_FROM (subdomeniul de trimitere), reply pe contact@
//   • pauză între trimiteri (anti rate-limit Resend) + retry la 429
//   • footer + header List-Unsubscribe semnat pe user_id (&s=news)
//   • log în email_send_log (consum) + broadcast_log (istoric)
//
// Body:
//   { dryRun: true }                       → doar numără destinatarii
//   { testEmail, subject, html, lang? }    → o singură probă (unsub legat de admin)
//   { subject, html, lang?, limit? }       → trimitere reală către toți userii
//
// Personalizare: „__PRENUME__"/„__FN__" din subject/html sunt înlocuite
// per destinatar cu prenumele userului (profiles.full_name).
//
// Deploy: `supabase functions deploy send-broadcast`. verify_jwt = false —
// citim tokenul manual (ca la send-group-email). Rulează DUPĂ migrația
// 20260723 (are nevoie de coloana product_emails_opt_out).
// ============================================================

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''
const APP_URL = (Deno.env.get('APP_URL') || 'https://getaromatool.com').replace(/\/$/, '')
// Adresa de trimitere pentru newsletter. Preferăm NEWS_MAIL_FROM (ex.
// news@send.getaromatool.com); cădem pe MAIL_FROM dacă nu e setat.
const MAIL_FROM =
  Deno.env.get('NEWS_MAIL_FROM') || Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'
const FROM_NAME = Deno.env.get('NEWS_FROM_NAME') || 'AromaTool — Noutăți'
// Răspunsurile merg în inboxul real; adresa de trimitere nu primește emailuri.
const REPLY_TO = Deno.env.get('REPLY_TO') || 'contact@getaromatool.com'

// Pauză între trimiteri ca să rămânem sub limita Resend (~2/sec).
const SEND_DELAY_MS = Number(Deno.env.get('SEND_DELAY_MS')) || 650
// Plafon per apel (batch). Baza de useri e mică; e o plasă de siguranță.
const MAX_PER_CALL = 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Header „From" (encoding UTF-8 pentru nume cu diacritice) ──
function encodeName(name: string): string {
  const clean = name.replace(/[<>"\r\n]/g, '').trim().slice(0, 80)
  if (/^[\x20-\x7E]*$/.test(clean)) return `"${clean}"`
  const bytes = new TextEncoder().encode(clean)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `=?UTF-8?B?${btoa(bin)}?=`
}
function buildFrom(): string {
  return `${encodeName(FROM_NAME)} <${MAIL_FROM}>`
}
function sanitizeSubject(subject: string): string {
  return (subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200)
}
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim())
function firstName(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || ''
}
// __PRENUME__ → salut („ Maria" / gol) ; __FN__ → prenume inline.
function applyName(s: string, fn: string): string {
  return s.replaceAll('__PRENUME__', fn ? ` ${fn}` : '').replaceAll('__FN__', fn)
}

// ── Dezabonare (semnat pe user_id; identic cu funcția unsubscribe) ──
async function signUnsub(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
const unsubApiUrl = (uid: string, t: string, lang: string) =>
  `${SUPABASE_URL}/functions/v1/unsubscribe?u=${uid}&t=${t}&s=news&l=${lang}`
const unsubHumanUrl = (uid: string, t: string, lang: string) =>
  `${APP_URL}/unsubscribe?u=${uid}&t=${t}&s=news&l=${lang}`

function injectUnsubFooter(html: string, link: string, lang: string): string {
  const q = lang === 'en' ? "Don't want these emails?" : 'Nu mai vrei aceste emailuri?'
  const label = lang === 'en' ? 'Unsubscribe' : 'Dezabonează-te'
  const footer = `<div style="padding:8px 28px 26px;font-size:11px;color:#A89888;text-align:center;font-family:sans-serif;line-height:1.6">${q} <a href="${link}" style="color:#A89888;text-decoration:underline">${label}</a>.</div>`
  return html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer
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
    throw new Error((data as { message?: string }).message || `Resend ${res.status}`)
  }
}

// Toți userii (id + email), paginat prin Admin API.
async function listAllUsers(
  supabase: ReturnType<typeof createClient>,
): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  const perPage = 1000
  for (let page = 1; page < 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []
    for (const u of users) if (u.email) out.push({ id: u.id, email: u.email })
    if (users.length < perPage) break
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { subject, html, lang: rawLang, testEmail, dryRun, limit } = await req.json()
    const lang = rawLang === 'en' ? 'en' : 'ro'

    // ── AUTENTIFICARE: doar admin ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return json({ error: 'Forbidden' }, 403)

    // ── „Câți primesc?": numără eligibilii, nu trimite ──
    if (dryRun) {
      const users = await listAllUsers(supabase)
      const { data: profs } = await supabase
        .from('profiles').select('id, product_emails_opt_out, account_emails_opt_out')
      const optedOut = new Set(
        (profs ?? [])
          .filter((p) => p.product_emails_opt_out || p.account_emails_opt_out)
          .map((p) => p.id as string),
      )
      const recipients = users.filter((u) => isValidEmail(u.email) && !optedOut.has(u.id)).length
      return json({ ok: true, mode: 'dryRun', total: users.length, optedOut: optedOut.size, recipients })
    }

    // De aici avem nevoie de Resend + conținut.
    if (!RESEND_API_KEY) return json({ error: 'missing_resend_key' }, 500)
    if (!subject || !html) return json({ error: 'Missing required fields: subject, html' }, 400)
    const cleanSubject = sanitizeSubject(subject)
    const fromHeader = buildFrom()

    // ── PROBĂ (unsub funcțional, legat de contul adminului) ──
    if (testEmail) {
      const to = String(testEmail).trim()
      if (!isValidEmail(to)) return json({ error: 'Email de probă invalid.' }, 400)
      const fn = firstName((user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined)
      let finalHtml = applyName(String(html), fn)
      let unsubHeaders: Record<string, string> = {}
      if (UNSUB_SECRET) {
        const t = await signUnsub(user.id)
        finalHtml = injectUnsubFooter(finalHtml, unsubHumanUrl(user.id, t, lang), lang)
        unsubHeaders = {
          'List-Unsubscribe': `<${unsubApiUrl(user.id, t, lang)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      }
      const payload: Record<string, unknown> = {
        from: fromHeader, reply_to: REPLY_TO, to,
        subject: applyName(cleanSubject, fn), html: finalHtml,
      }
      if (Object.keys(unsubHeaders).length) payload.headers = unsubHeaders
      try {
        await resendSend(payload)
        return json({ ok: true, mode: 'test', to })
      } catch (e) {
        return json({ ok: false, mode: 'test', error: e instanceof Error ? e.message : String(e) }, 500)
      }
    }

    // ── TRIMITERE REALĂ ──
    const users = await listAllUsers(supabase)
    const { data: profs } = await supabase
      .from('profiles').select('id, full_name, product_emails_opt_out, account_emails_opt_out')
    const profById = new Map((profs ?? []).map((p) => [p.id as string, p]))

    let eligible = users.filter((u) => {
      if (!isValidEmail(u.email)) return false
      const p = profById.get(u.id)
      if (p && (p.product_emails_opt_out || p.account_emails_opt_out)) return false
      return true
    })
    const cap = Math.min(Number(limit) || MAX_PER_CALL, MAX_PER_CALL)
    if (eligible.length > cap) eligible = eligible.slice(0, cap)

    let sent = 0, failed = 0
    const errors: { email: string; error: string }[] = []

    for (let i = 0; i < eligible.length; i++) {
      const u = eligible[i]
      try {
        const p = profById.get(u.id)
        const fn = firstName(p?.full_name as string | undefined)
        let finalHtml = applyName(String(html), fn)
        const finalSubject = applyName(cleanSubject, fn)

        let unsubHeaders: Record<string, string> = {}
        if (UNSUB_SECRET) {
          const t = await signUnsub(u.id)
          finalHtml = injectUnsubFooter(finalHtml, unsubHumanUrl(u.id, t, lang), lang)
          unsubHeaders = {
            'List-Unsubscribe': `<${unsubApiUrl(u.id, t, lang)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        }
        const payload: Record<string, unknown> = {
          from: fromHeader, reply_to: REPLY_TO, to: u.email,
          subject: finalSubject, html: finalHtml,
        }
        if (Object.keys(unsubHeaders).length) payload.headers = unsubHeaders

        await resendSend(payload)
        sent++
        // Consum (cardul din Admin) — atribuit adminului care a trimis.
        await supabase.from('email_send_log').insert({ user_id: user.id })
      } catch (e) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`send-broadcast: eșec pentru ${u.email}: ${msg}`)
        errors.push({ email: u.email, error: msg })
      }
      if (i < eligible.length - 1) await sleep(SEND_DELAY_MS)
    }

    // Istoric.
    await supabase.from('broadcast_log').insert({
      subject: cleanSubject, recipients: eligible.length, sent, failed, created_by: user.id,
    })

    return json({ ok: true, mode: 'send', recipients: eligible.length, sent, failed, errors })
  } catch (error) {
    console.error('send-broadcast error:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
