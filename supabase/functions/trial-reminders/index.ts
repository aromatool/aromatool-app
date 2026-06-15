import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// TRIAL REMINDERS — email-uri LIFECYCLE către userii AromaTool
// (distribuitorii cu cont), NU către clienții lor. Secvența:
//   • trial_t3      — cu 3 zile înainte de expirarea trialului
//   • trial_t1      — în ultima zi (expiră mâine)
//   • trial_expired — chiar după expirare, dacă nu s-a abonat
//
// Rulează din pg_cron (o dată pe zi) cu header x-cron-secret.
// Test manual: orice user autentificat → primește o probă pe contul
// propriu (body { kind }), fără dedupe și fără a respecta opt-out-ul.
//
// Dedupe per (user, kind, trial_ends_at) prin account_email_log →
// re-extinderea trialului (cod de lansare) permite un nou set.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'
const APP_URL = (Deno.env.get('APP_URL') || 'https://app.aromatool.com').replace(/\/$/, '')
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Secret pentru semnarea linkului de dezabonare; identic cu `unsubscribe`.
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''
const EMAIL_ASSET_BASE =
  (Deno.env.get('EMAIL_ASSET_BASE') || `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/email-assets`).replace(/\/$/, '')

const DAY_MS = 1000 * 60 * 60 * 24

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type Kind = 'trial_t3' | 'trial_t1' | 'trial_expired'

// ── Helpers ──────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Data calendaristică (YYYY-MM-DD) în timezone-ul userului.
function localDate(tz: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

// Diferența în zile CALENDARISTICE (în tz) între now și data de expirare.
// 3 = expiră peste 3 zile; 0 = expiră azi; -1 = a expirat ieri.
function calendarDaysToExpiry(tz: string, now: Date, expiry: Date): number {
  const a = localDate(tz, now)
  const b = localDate(tz, expiry)
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))
  return Math.round((db - da) / DAY_MS)
}

// HMAC-SHA256(userId) → hex. Identic cu `unsubscribe` (ramura u=).
async function signUnsub(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(UNSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
// One-click (List-Unsubscribe, RFC 8058) → funcția Supabase (endpoint real).
async function unsubUrl(userId: string, lang: 'ro' | 'en'): Promise<string> {
  const t = await signUnsub(userId)
  return `${SUPABASE_URL}/functions/v1/unsubscribe?u=${userId}&t=${t}&l=${lang}`
}
// Linkul VIZIBIL din footer → pagina /unsubscribe din app (se randează corect;
// funcția pe *.supabase.co ar apărea ca text brut din cauza rescrierii Content-Type).
async function unsubHumanUrl(userId: string, lang: 'ro' | 'en'): Promise<string> {
  const t = await signUnsub(userId)
  return `${APP_URL}/unsubscribe?u=${userId}&t=${t}&l=${lang}`
}

// ── Conținut email (RO/EN) ───────────────────────────────────
type Copy = { subject: string; eyebrow: string; headline: string; body: string; cta: string }

function copyFor(kind: Kind, lang: 'ro' | 'en', firstName: string, days: number): Copy {
  const name = firstName || (lang === 'en' ? 'there' : 'acolo')
  if (lang === 'en') {
    if (kind === 'trial_t3') return {
      subject: `Your AromaTool trial ends in ${days} days 🌿`,
      eyebrow: 'Your trial', headline: `${days} days left in your trial`,
      body: `Hi ${name}, just a friendly heads-up — your free trial ends in ${days} days. Subscribe now to keep your contacts, offers and follow-ups without interruption.`,
      cta: 'See plan',
    }
    if (kind === 'trial_t1') return {
      subject: 'Your AromaTool trial ends tomorrow 🌿',
      eyebrow: 'Your trial', headline: 'Your trial ends tomorrow',
      body: `Hi ${name}, your free trial ends tomorrow. Subscribe today so you don't lose access to your contacts, offers and automated follow-ups.`,
      cta: 'Subscribe',
    }
    return {
      subject: 'Your AromaTool trial has ended',
      eyebrow: 'Your trial', headline: 'Your free trial has ended',
      body: `Hi ${name}, your free trial has ended. Your data is safe — subscribe anytime to pick up right where you left off with your contacts, offers and follow-ups.`,
      cta: 'Reactivate access',
    }
  }
  // RO
  if (kind === 'trial_t3') return {
    subject: `Perioada ta gratuită AromaTool expiră în ${days} zile 🌿`,
    eyebrow: 'Perioada ta gratuită', headline: `Mai ai ${days} zile din perioada gratuită`,
    body: `Bună ${name}, doar un memento prietenos — perioada ta gratuită expiră în ${days} zile. Abonează-te acum ca să-ți păstrezi contactele, ofertele și follow-up-urile fără întrerupere.`,
    cta: 'Vezi planul',
  }
  if (kind === 'trial_t1') return {
    subject: 'Perioada ta gratuită AromaTool expiră mâine 🌿',
    eyebrow: 'Perioada ta gratuită', headline: 'Perioada ta gratuită expiră mâine',
    body: `Bună ${name}, perioada ta gratuită expiră mâine. Abonează-te azi ca să nu pierzi accesul la contacte, oferte și follow-up-urile automate.`,
    cta: 'Abonează-te',
  }
  return {
    subject: 'Perioada ta gratuită AromaTool s-a încheiat',
    eyebrow: 'Perioada ta gratuită', headline: 'Perioada ta gratuită s-a încheiat',
    body: `Bună ${name}, perioada ta gratuită s-a încheiat. Datele tale sunt în siguranță — te poți abona oricând și continui exact de unde ai rămas, cu contactele, ofertele și follow-up-urile tale.`,
    cta: 'Reactivează accesul',
  }
}

function buildEmail(c: Copy, unsubLink: string, settingsLink: string, lang: 'ro' | 'en'): string {
  const footerNote = lang === 'en'
    ? `You're receiving this because you have an AromaTool account.`
    : `Primești acest email pentru că ai un cont AromaTool.`
  const manage = lang === 'en' ? 'Manage in Settings' : 'Gestionează din Setări'
  const unsub = lang === 'en' ? 'Unsubscribe' : 'Dezabonează-te'

  return `
  <div style="background:#FAFAF7;padding:24px 0;font-family:'Helvetica Neue',Arial,sans-serif;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:0 auto;">
      <tr><td style="background:#ffffff;border:1px solid #EDE8E0;border-radius:16px;overflow:hidden;">
        <div style="padding:22px 28px;text-align:center;background:#ffffff;border-bottom:1px solid #EDE8E0;">
          <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td width="42" height="42" valign="middle" align="center">
                <img src="${EMAIL_ASSET_BASE}/email-logo.png" width="42" height="42" alt="AromaTool" style="display:block;width:42px;height:42px;border:0;border-radius:10px" />
              </td>
              <td style="padding-left:11px;" valign="middle" align="left">
                <div style="font-size:20px;font-weight:600;color:#3D3530;letter-spacing:-0.02em;line-height:1.1">AromaTool</div>
                <div style="font-size:9px;color:#A89888;letter-spacing:0.08em;margin-top:3px">crafted for your team</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:26px 28px;">
          <div style="font-size:12px;font-weight:600;color:#A89888;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(c.eyebrow)}</div>
          <div style="font-size:19px;font-weight:600;color:#3D3530;margin-top:6px;">${escapeHtml(c.headline)}</div>
          <div style="font-size:14px;color:#6A5A50;margin-top:10px;line-height:1.65;">${escapeHtml(c.body)}</div>
          <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 6px;">
            <tr><td align="center" style="border-radius:10px;background:#5C7A5C;">
              <a href="${settingsLink}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(c.cta)}</a>
            </td></tr>
          </table>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #EDE8E0;text-align:center;">
          <div style="font-size:11px;color:#A89888;line-height:1.6;">
            ${footerNote}<br/>
            <a href="${settingsLink}" style="color:#A89888;">${manage}</a> &nbsp;·&nbsp;
            <a href="${unsubLink}" style="color:#A89888;">${unsub}</a>
          </div>
        </div>
      </td></tr>
    </table>
  </div>`
}

async function sendEmail(to: string, subject: string, html: string, unsubLink: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `AromaTool <${MAIL_FROM}>`,
      to, subject, html,
      // RFC 8058 one-click (cerut de Gmail/Yahoo pentru bulk).
      headers: {
        'List-Unsubscribe': `<${unsubLink}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  })
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── AUTENTIFICARE: cron (secret) sau probă manuală (JWT) ──────
  let trigger: 'cron' | 'manual' = 'cron'
  let testUserId: string | null = null
  let testKind: Kind = 'trial_t3'
  const cronSecret = req.headers.get('x-cron-secret')

  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    // rulare reală din cron
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    trigger = 'manual'
    testUserId = user.id
    try {
      const body = await req.json()
      if (body?.kind === 'trial_t1' || body?.kind === 'trial_expired') testKind = body.kind
    } catch { /* fără body → t3 implicit */ }
  }

  const now = new Date()
  let processed = 0, sent = 0, failed = 0
  const errors: { user_id: string; error: string }[] = []

  // ── UTILIZATORI ELIGIBILI ────────────────────────────────────
  let query = supabase
    .from('profiles')
    .select('id, full_name, language_code, timezone, trial_ends_at, subscription_status, is_admin, free_access, account_emails_opt_out')
  query = testUserId
    ? query.eq('id', testUserId)
    : query
        .eq('account_emails_opt_out', false)
        .eq('is_admin', false)
        .eq('free_access', false)
        .not('trial_ends_at', 'is', null)
        .neq('subscription_status', 'active')
  const { data: profiles, error: profErr } = await query
  if (profErr) return json({ error: profErr.message }, 500)

  for (const p of profiles ?? []) {
    const tz = p.timezone || 'Europe/Bucharest'
    const lang: 'ro' | 'en' = p.language_code === 'en' ? 'en' : 'ro'
    const firstName = (p.full_name || '').split(' ')[0]

    // ── Determină tipul de reminder ────────────────────────────
    let kind: Kind | null = null
    let days = 0

    if (trigger === 'manual') {
      // Probă: trimite tipul cerut, fără dedupe / fără opt-out.
      kind = testKind
      days = testKind === 'trial_t3' ? 3 : 1
    } else {
      if (!p.trial_ends_at) continue
      const expiry = new Date(p.trial_ends_at)
      const msToExpiry = expiry.getTime() - now.getTime()
      const calDays = calendarDaysToExpiry(tz, now, expiry)

      if (msToExpiry > 0 && calDays === 3) { kind = 'trial_t3'; days = 3 }
      else if (msToExpiry > 0 && calDays === 1) { kind = 'trial_t1'; days = 1 }
      // Tocmai expirat (în ultimele 2 zile) și fără abonament activ.
      else if (msToExpiry <= 0 && msToExpiry > -2 * DAY_MS) { kind = 'trial_expired' }

      if (!kind) continue
    }

    processed++
    try {
      // Dedupe (doar pe cron): un singur email de tip X pe ciclul de trial.
      if (trigger === 'cron') {
        const { data: existing } = await supabase
          .from('account_email_log')
          .select('id')
          .eq('user_id', p.id)
          .eq('kind', kind)
          .eq('trial_ends_at', p.trial_ends_at)
          .maybeSingle()
        if (existing) { processed--; continue }
      }

      // Emailul destinatarului = emailul de login al userului.
      const { data: authUser } = await supabase.auth.admin.getUserById(p.id)
      const toEmail = authUser?.user?.email
      if (!toEmail) { processed--; continue }

      const c = copyFor(kind, lang, firstName, days)
      const oneClickLink = await unsubUrl(p.id, lang)        // header one-click → funcție
      const humanLink = await unsubHumanUrl(p.id, lang)      // footer vizibil → app
      const settingsLink = `${APP_URL}/app/settings#subscription`
      const html = buildEmail(c, humanLink, settingsLink, lang)
      await sendEmail(toEmail, c.subject, html, oneClickLink)
      sent++

      // Marchează ca trimis (dedupe). În probă nu marcăm.
      if (trigger === 'cron') {
        await supabase.from('account_email_log').insert({
          user_id: p.id, kind, trial_ends_at: p.trial_ends_at,
        })
      }
    } catch (e) {
      failed++
      errors.push({ user_id: p.id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  await supabase.from('account_email_jobs').insert({
    trigger,
    users_processed: processed,
    emails_sent: sent,
    emails_failed: failed,
    errors,
    completed_at: new Date().toISOString(),
  })

  return json({ ok: true, trigger, processed, sent, failed, errors })
})
