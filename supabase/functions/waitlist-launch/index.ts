import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// WAITLIST LAUNCH — emailul de „suntem live" către cei înscriși pe
// pagina coming-soon. Trimite codul comun de 15 zile gratis + CTA
// spre app și marchează `notified_at` ca să nu retrimită.
//
// Acces PROTEJAT (ca import-products / trial-reminders):
//   • cron real        → header x-cron-secret == CRON_SECRET
//   • declanșare manuală→ JWT de admin (is_admin = true)
//
// Body opțional:
//   { code }       — codul de lansare de inclus (altfel LAUNCH_CODE din env)
//   { testEmail }  — trimite o singură probă la adresa dată, FĂRĂ DB
//   { dryRun }     — calculează destinatarii, NU trimite, NU marchează
//   { limit }      — câți să proceseze într-o rulare (batch; implicit 200)
//
// Deploy: `supabase functions deploy waitlist-launch` (CU verify-jwt
// implicit — e protejat). Tabela `waitlist` accesată via service_role.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'
const APP_URL = (Deno.env.get('APP_URL') || 'https://app.aromatool.com').replace(/\/$/, '')
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Codul comun de lansare (15 zile). Poate fi suprascris din body { code }.
const LAUNCH_CODE = (Deno.env.get('LAUNCH_CODE') || '').trim().toUpperCase()
// Adresa pentru dezabonare (mailto) — waitlist n-are user_id, deci nu putem
// semna un link ca la trial-reminders. Un mailto e suficient pentru un one-off.
const UNSUB_MAILTO =
  Deno.env.get('UNSUB_MAILTO') || (MAIL_FROM.includes('@') ? MAIL_FROM : 'contact@getaromatool.com')
const EMAIL_ASSET_BASE =
  (Deno.env.get('EMAIL_ASSET_BASE') || `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/email-assets`).replace(/\/$/, '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ── Helpers ──────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Conținut email (RO) ──────────────────────────────────────
// Waitlist e colectat de pe pagina .ro coming-soon → email în română.
function copyLaunch(code: string) {
  return {
    subject: 'AromaTool e live 🌿 — codul tău de 15 zile gratis',
    eyebrow: 'Suntem live',
    headline: 'AromaTool e disponibil — ai 15 zile gratis',
    body: 'Ai lăsat adresa ta ca să afli primul când lansăm. Gata — AromaTool e live! Creează-ți contul, introdu codul de mai jos la înscriere și ai 15 zile gratuite ca să-ți organizezi contactele, ofertele și follow-up-urile.',
    code,
    codeNote: 'Introdu acest cod la crearea contului ca să activezi perioada gratuită.',
    cta: 'Creează cont gratuit',
  }
}

function buildEmail(c: ReturnType<typeof copyLaunch>, ctaLink: string): string {
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
          <div style="margin:22px 0 6px;padding:16px;border:1px dashed #C9BBA8;border-radius:12px;background:#FAF7F2;text-align:center;">
            <div style="font-size:11px;font-weight:600;color:#A89888;text-transform:uppercase;letter-spacing:0.08em;">Codul tău</div>
            <div style="font-size:26px;font-weight:700;color:#5C7A5C;letter-spacing:0.12em;margin-top:6px;font-family:'SF Mono',Consolas,monospace;">${escapeHtml(c.code)}</div>
            <div style="font-size:12px;color:#6A5A50;margin-top:8px;line-height:1.5;">${escapeHtml(c.codeNote)}</div>
          </div>
          <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 6px;">
            <tr><td align="center" style="border-radius:10px;background:#5C7A5C;">
              <a href="${ctaLink}" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(c.cta)}</a>
            </td></tr>
          </table>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #EDE8E0;text-align:center;">
          <div style="font-size:11px;color:#A89888;line-height:1.6;">
            Primești acest email pentru că te-ai înscris pe lista de așteptare AromaTool.<br/>
            <a href="mailto:${escapeHtml(UNSUB_MAILTO)}?subject=Dezabonare" style="color:#A89888;">Dezabonează-te</a>
          </div>
        </div>
      </td></tr>
    </table>
  </div>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `AromaTool <${MAIL_FROM}>`,
      to, subject, html,
      headers: {
        'List-Unsubscribe': `<mailto:${UNSUB_MAILTO}?subject=Dezabonare>`,
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

  // ── Body (opțional) ──────────────────────────────────────────
  let body: { code?: string; testEmail?: string; dryRun?: boolean; limit?: number } = {}
  try { body = await req.json() } catch { /* fără body → ok */ }

  // ── AUTENTIFICARE: cron (secret) sau admin (JWT) ─────────────
  const cronSecret = req.headers.get('x-cron-secret')
  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    // rulare reală din cron
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    // Doar adminii pot declanșa manual.
    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return json({ error: 'Forbidden' }, 403)
  }

  const code = (body.code || LAUNCH_CODE).trim().toUpperCase()
  if (!code) return json({ error: 'missing_code' }, 400)
  if (!RESEND_API_KEY) return json({ error: 'missing_resend_key' }, 500)

  const ctaLink = `${APP_URL}/auth`

  // ── Probă: o singură adresă, fără atingerea DB ───────────────
  if (body.testEmail) {
    const c = copyLaunch(code)
    const html = buildEmail(c, ctaLink)
    try {
      await sendEmail(body.testEmail, c.subject, html)
      return json({ ok: true, mode: 'test', to: body.testEmail })
    } catch (e) {
      return json({ ok: false, mode: 'test', error: e instanceof Error ? e.message : String(e) }, 500)
    }
  }

  // ── Destinatari: înscriși care n-au primit încă emailul ──────
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 1000)
  const { data: rows, error: selErr } = await supabase
    .from('waitlist')
    .select('id, email')
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (selErr) return json({ error: selErr.message }, 500)

  if (body.dryRun) {
    return json({ ok: true, mode: 'dryRun', recipients: rows?.length ?? 0 })
  }

  const c = copyLaunch(code)
  const html = buildEmail(c, ctaLink)
  let sent = 0, failed = 0
  const errors: { email: string; error: string }[] = []

  for (const r of rows ?? []) {
    try {
      await sendEmail(r.email, c.subject, html)
      sent++
      await supabase
        .from('waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', r.id)
    } catch (e) {
      failed++
      errors.push({ email: r.email, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return json({ ok: true, mode: 'send', processed: rows?.length ?? 0, sent, failed, errors })
})
