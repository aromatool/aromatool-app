import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// SURSA UNICĂ DE ADEVĂR — aceeași logică Focus Today ca Dashboard-ul.
import { getFocusToday } from '../../../src/lib/focusToday.ts'
// Textele acțiunilor vin din aceeași sursă i18n ca UI-ul (deocamdată RO).
import roActions from '../../../src/i18n/locales/ro/actions.json' with { type: 'json' }

// Mini-traducător server-side compatibil cu semnătura TFunction folosită de
// recommendedAction.ts. Citește din ro/actions.json și interpolează {{param}}.
// deno-lint-ignore no-explicit-any
function tServer(key: string, params?: Record<string, unknown>): any {
  // Cheile sunt de forma „actions.title.x", iar conținutul ro/actions.json
  // stă la RĂDĂCINĂ (fără wrapper „actions" — vezi fixul de i18n). Mapăm
  // namespace-ul „actions" pe întreg fișierul, ca în i18next (out[ns]=mod).
  // deno-lint-ignore no-explicit-any
  const root: any = { actions: roActions as any }
  const resolve = (k: string): string | undefined => {
    // deno-lint-ignore no-explicit-any
    let v: any = root
    for (const p of k.split('.')) v = v?.[p]
    return typeof v === 'string' ? v : undefined
  }

  let s = resolve(key)

  // Pluralizare în stil i18next: multe motive (ex: inactiveDays, noOfferYet)
  // există DOAR în variante cu sufix (_zero/_one/_few/_other), nu ca cheie
  // directă. Fără asta apăreau ca text brut în emailul Daily Focus
  // („actions.reason.inactiveDays"). Selectăm forma după regulile CLDR ro.
  if (s === undefined && params && typeof params.count === 'number') {
    const n = params.count
    if (n === 0) s = resolve(`${key}_zero`)
    if (s === undefined) {
      const cat = new Intl.PluralRules('ro-RO').select(n) // one | few | other
      s = resolve(`${key}_${cat}`) ?? resolve(`${key}_other`)
    }
  }

  if (s === undefined) s = key
  if (params) {
    for (const [k, val] of Object.entries(params)) {
      s = s.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(val))
    }
  }
  return s
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'onboarding@resend.dev'
const APP_URL = (Deno.env.get('APP_URL') || 'https://getaromatool.com').replace(/\/$/, '')
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
// Baza pentru imaginile din email (logo). Implicit bucket-ul public Supabase.
const EMAIL_ASSET_BASE =
  (Deno.env.get('EMAIL_ASSET_BASE') || `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/email-assets`).replace(/\/$/, '')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ── Timezone helpers ─────────────────────────────────────────
function localHour(tz: string, d: Date): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: '2-digit', hourCycle: 'h23',
    }).format(d)
    return parseInt(s, 10)
  } catch {
    return new Date(d).getUTCHours()
  }
}
function localDate(tz: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Email Focus Today ────────────────────────────────────────
function buildEmail(
  firstName: string,
  items: { name: string; actionTitle: string; reason: string }[],
): { subject: string; html: string } {
  const count = items.length
  const subject = count === 1
    ? '1 contact are nevoie de atenția ta azi 🌿'
    : `${count} contacte au nevoie de atenția ta azi 🌿`

  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #F0ECE4;font-family:'Helvetica Neue',Arial,sans-serif;">
        <div style="font-size:15px;font-weight:600;color:#3D3530;">${i + 1}. ${escapeHtml(it.name)}</div>
        <div style="font-size:13px;font-weight:500;color:#5C7A5C;margin-top:4px;">${escapeHtml(it.actionTitle)}</div>
        <div style="font-size:13px;color:#A89888;margin-top:2px;line-height:1.5;">${escapeHtml(it.reason)}</div>
      </td>
    </tr>`).join('')

  const header = `
    <div style="padding:22px 28px;text-align:center;background:#ffffff;border-bottom:1px solid #EDE8E0;">
      <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td width="42" height="42" valign="middle" align="center">
            <img src="${EMAIL_ASSET_BASE}/email-logo.png" width="42" height="42" alt="AromaTool" style="display:block;width:42px;height:42px;border:0;border-radius:10px" />
          </td>
          <td style="padding-left:11px;" valign="middle" align="left">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;color:#3D3530;letter-spacing:-0.02em;line-height:1.1">AromaTool</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:9px;color:#A89888;letter-spacing:0.08em;margin-top:3px">crafted for your team</div>
          </td>
        </tr>
      </table>
    </div>`

  const html = `
  <div style="background:#FAFAF7;padding:24px 0;font-family:'Helvetica Neue',Arial,sans-serif;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:0 auto;">
      <tr><td style="background:#ffffff;border:1px solid #EDE8E0;border-radius:16px;overflow:hidden;">
        ${header}
        <div style="padding:26px 28px;">
          <div style="font-size:12px;font-weight:600;color:#A89888;text-transform:uppercase;letter-spacing:0.08em;">Focus Today</div>
          <div style="font-size:18px;font-weight:600;color:#3D3530;margin-top:6px;">Bună ${escapeHtml(firstName)} 🌿</div>
          <div style="font-size:14px;color:#6A5A50;margin-top:6px;line-height:1.6;">
            ${count === 1
              ? 'Ai un contact care merită atenția ta astăzi.'
              : `Ai ${count} contacte care merită atenția ta astăzi.`}
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
            ${rows}
          </table>

          <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 6px;">
            <tr><td align="center" style="border-radius:10px;background:#5C7A5C;">
              <a href="${APP_URL}/app/dashboard" style="display:inline-block;padding:13px 30px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Deschide AromaTool</a>
            </td></tr>
          </table>
          <div style="text-align:center;margin-top:10px;">
            <a href="${APP_URL}/app/contacts?filter=needs_attention" style="font-size:12px;color:#5C7A5C;text-decoration:none;">Vezi toate contactele de azi →</a>
          </div>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #EDE8E0;text-align:center;">
          <div style="font-size:11px;color:#A89888;line-height:1.5;">
            Primești acest email fiindcă ai activat Daily Focus.<br/>
            Îl poți opri oricând din <a href="${APP_URL}/app/settings" style="color:#A89888;">Setări</a>.
          </div>
        </div>
      </td></tr>
    </table>
  </div>`

  return { subject, html }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `AromaTool <${MAIL_FROM}>`, to, subject, html }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || `Resend ${res.status}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── AUTENTIFICARE: cron (secret) sau admin (JWT, pentru test) ──
  let trigger: 'cron' | 'manual' = 'cron'
  let testUserId: string | null = null
  const cronSecret = req.headers.get('x-cron-secret')

  if (CRON_SECRET && cronSecret && cronSecret === CRON_SECRET) {
    // rulare din cron — procesează userii „due" acum
  } else {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)
    // Orice user autentificat poate rula o probă, DOAR pentru contul propriu
    // (emailul pleacă exclusiv către el însuși), ignorând ora aleasă.
    trigger = 'manual'
    testUserId = user.id
  }

  const now = new Date()
  let processed = 0, sent = 0, failed = 0
  const errors: { user_id: string; error: string }[] = []

  // ── UTILIZATORI ELIGIBILI ────────────────────────────────────
  let query = supabase
    .from('profiles')
    .select('id, full_name, daily_focus_enabled, daily_focus_hour, timezone, daily_focus_last_sent')
  query = testUserId
    ? query.eq('id', testUserId)
    : query.eq('daily_focus_enabled', true)
  const { data: profiles, error: profErr } = await query
  if (profErr) return json({ error: profErr.message }, 500)

  for (const p of profiles ?? []) {
    const tz = p.timezone || 'Europe/Bucharest'
    const today = localDate(tz, now)

    // În modul cron: doar dacă ora locală = ora aleasă și n-am trimis azi.
    if (trigger === 'cron') {
      if (localHour(tz, now) !== p.daily_focus_hour) continue
      if (p.daily_focus_last_sent === today) continue
    }

    processed++
    try {
      // Emailul destinatarului = emailul de login al userului.
      const { data: authUser } = await supabase.auth.admin.getUserById(p.id)
      const toEmail = authUser?.user?.email
      if (!toEmail) { continue }

      const [{ data: contacts }, { data: offers }, { data: fuLog }] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', p.id),
        supabase.from('offers').select('id,contact_id,total_eur,sent_at').eq('user_id', p.id),
        supabase.from('followup_log').select('id,contact_id,sent_at,status').eq('user_id', p.id),
      ])

      const focus = getFocusToday(
        (contacts ?? []) as never,
        (offers ?? []) as never,
        (fuLog ?? []) as never,
        tServer as never,
        5,
      )

      // Regula de aur: dacă Focus Today e gol, NU trimite nimic.
      if (focus.length === 0) continue

      const items = focus.map((f) => ({
        name: f.contact.name,
        actionTitle: f.action.title,
        reason: f.action.reason,
      }))
      const firstName = (p.full_name || '').split(' ')[0] || 'acolo'
      const { subject, html } = buildEmail(firstName, items)
      await sendEmail(toEmail, subject, html)
      sent++

      // Marchează ziua ca trimisă (dedupe). În test nu marcăm.
      if (trigger === 'cron') {
        await supabase
          .from('profiles')
          .update({ daily_focus_last_sent: today })
          .eq('id', p.id)
      }
    } catch (e) {
      failed++
      errors.push({ user_id: p.id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // ── LOG JOB ──────────────────────────────────────────────────
  await supabase.from('daily_focus_jobs').insert({
    trigger,
    users_processed: processed,
    emails_sent: sent,
    emails_failed: failed,
    errors,
    completed_at: new Date().toISOString(),
  })

  return json({ ok: true, trigger, processed, sent, failed, errors })
})
