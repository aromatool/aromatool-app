import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// UNSUBSCRIBE — dezabonare destinatar (conformitate email UE).
// Link semnat în fiecare email. Două ramuri DISTINCTE:
//   ?c=<contactId>  → contacts.email_opt_out = true
//                     (clienții userului — emailuri de ofertă/follow-up)
//   ?u=<userId>     → profiles.account_emails_opt_out = true
//                     (userii AromaTool — emailuri despre cont/abonament)
// Ambele:
//   GET  → afișează pagină de confirmare
//   POST → one-click unsubscribe (RFC 8058, cerut de Gmail/Yahoo)
// Public (verify_jwt = false) — autorizarea se face prin tokenul HMAC.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Secret pentru semnarea tokenului; fallback pe CRON_SECRET ca să nu
// adăugăm un secret nou obligatoriu.
const UNSUB_SECRET =
  Deno.env.get('UNSUBSCRIBE_SECRET') || Deno.env.get('CRON_SECRET') || ''

// Calculează HMAC-SHA256(id) → hex. `id` = contactId (send-email) sau
// userId (trial-reminders). Trebuie identic cu funcția care semnează.
async function sign(id: string): Promise<string> {
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
    new TextEncoder().encode(id),
  )
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Comparație în timp constant (evită timing attacks).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function page(title: string, body: string, lang: 'ro' | 'en' = 'ro'): Response {
  return new Response(
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title></head>
    <body style="font-family:system-ui,sans-serif;background:#FAFAF7;color:#3D3530;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
      <div style="max-width:420px;text-align:center;padding:32px">
        <div style="font-size:42px;margin-bottom:12px">🌿</div>
        <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
        <p style="color:#6A5A50;line-height:1.6;font-size:14px">${body}</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

// Validează tokenul FĂRĂ a scrie nimic (folosit pe GET). Generic: id =
// contactId sau userId.
async function isValidToken(id: string, token: string): Promise<boolean> {
  if (!id || !token || !UNSUB_SECRET) return false
  const expected = await sign(id)
  return safeEqual(token, expected)
}

// ── CONTACT (clienții userului) ──────────────────────────────
// Scrie efectiv dezabonarea contactului (folosit DOAR pe POST).
async function doUnsubscribe(contactId: string, token: string): Promise<boolean> {
  if (!(await isValidToken(contactId, token))) return false
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await supabase
    .from('contacts')
    .update({ email_opt_out: true })
    .eq('id', contactId)
  return !error
}

// ── USER AromaTool (emailuri despre cont/abonament) ──────────
// Scrie dezabonarea userului (folosit DOAR pe POST). Ramură separată
// de contacts — nu confundăm userii cu clienții lor.
async function doUnsubscribeUser(userId: string, token: string): Promise<boolean> {
  if (!(await isValidToken(userId, token))) return false
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await supabase
    .from('profiles')
    .update({ account_emails_opt_out: true })
    .eq('id', userId)
  return !error
}

// Texte bilingve pentru ramura USER (linkul nu știe limba decât din ?l=).
const USER_TXT = {
  ro: {
    confirmTitle: 'Vrei să te dezabonezi?',
    confirmBody:
      'Nu vei mai primi emailuri despre contul și abonamentul tău AromaTool. Vei primi în continuare emailurile esențiale (ex. confirmări de plată).',
    confirmBtn: 'Dezabonează-mă',
    doneTitle: 'Te-ai dezabonat',
    doneBody:
      'Nu vei mai primi emailuri despre cont și abonament. Poți reactiva oricând din Setări → Cont.',
    invalidTitle: 'Link invalid',
    invalidBody: 'Linkul de dezabonare nu este valid sau a expirat.',
  },
  en: {
    confirmTitle: 'Unsubscribe?',
    confirmBody:
      "You'll no longer receive emails about your AromaTool account and subscription. Essential emails (e.g. payment receipts) will still be sent.",
    confirmBtn: 'Unsubscribe me',
    doneTitle: "You're unsubscribed",
    doneBody:
      "You'll no longer receive account and subscription emails. You can re-enable them anytime in Settings → Account.",
    invalidTitle: 'Invalid link',
    invalidBody: 'This unsubscribe link is not valid or has expired.',
  },
} as const

// Pagină de confirmare pentru ramura USER — POST către ?u=...
function confirmPageUser(userId: string, token: string, lang: 'ro' | 'en'): Response {
  const tx = USER_TXT[lang]
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${tx.confirmTitle}</title></head>
    <body style="font-family:system-ui,sans-serif;background:#FAFAF7;color:#3D3530;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
      <div style="max-width:420px;text-align:center;padding:32px">
        <div style="font-size:42px;margin-bottom:12px">🌿</div>
        <h1 style="font-size:20px;margin:0 0 8px">${tx.confirmTitle}</h1>
        <p style="color:#6A5A50;line-height:1.6;font-size:14px;margin-bottom:22px">${tx.confirmBody}</p>
        <form method="post" action="?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}&l=${lang}">
          <button type="submit" style="background:#5C7A5C;color:#fff;border:none;
            border-radius:10px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer">
            ${tx.confirmBtn}
          </button>
        </form>
      </div>
    </body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// Pagină de confirmare cu buton care face POST către același URL.
// IMPORTANT: nu mutăm nimic pe GET — scanerele de email (Outlook SafeLinks,
// Proofpoint) și prefetch-ul fac GET automat și ar dezabona oameni fără voia lor.
function confirmPage(contactId: string, token: string): Response {
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Confirmă dezabonarea</title></head>
    <body style="font-family:system-ui,sans-serif;background:#FAFAF7;color:#3D3530;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
      <div style="max-width:420px;text-align:center;padding:32px">
        <div style="font-size:42px;margin-bottom:12px">🌿</div>
        <h1 style="font-size:20px;margin:0 0 8px">Vrei să te dezabonezi?</h1>
        <p style="color:#6A5A50;line-height:1.6;font-size:14px;margin-bottom:22px">
          Nu vei mai primi emailuri de la acest expeditor. Apasă butonul pentru a confirma.
        </p>
        <form method="post" action="?c=${encodeURIComponent(contactId)}&t=${encodeURIComponent(token)}">
          <button type="submit" style="background:#5C7A5C;color:#fff;border:none;
            border-radius:10px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer">
            Dezabonează-mă
          </button>
        </form>
      </div>
    </body></html>`
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

serve(async (req) => {
  const url = new URL(req.url)
  const contactId = url.searchParams.get('c') || ''
  const userId = url.searchParams.get('u') || ''
  const token = url.searchParams.get('t') || ''
  const lang: 'ro' | 'en' = url.searchParams.get('l') === 'en' ? 'en' : 'ro'

  // ── Ramura USER (emailuri despre cont/abonament AromaTool) ──
  // Are prioritate dacă există ?u=. Separată complet de contacts.
  if (userId) {
    const tx = USER_TXT[lang]
    if (req.method === 'POST') {
      const ok = await doUnsubscribeUser(userId, token)
      return ok
        ? page(tx.doneTitle, tx.doneBody, lang)
        : page(tx.invalidTitle, tx.invalidBody, lang)
    }
    const valid = await isValidToken(userId, token)
    return valid
      ? confirmPageUser(userId, token, lang)
      : page(tx.invalidTitle, tx.invalidBody, lang)
  }

  // ── Ramura CONTACT (clienții userului) — neschimbată ──
  // One-click (RFC 8058): Gmail/Yahoo trimit POST fără interacțiune. Acceptat.
  // Tot pe POST vine și butonul din pagina de confirmare (vezi mai jos).
  if (req.method === 'POST') {
    const ok = await doUnsubscribe(contactId, token)
    // Răspuns vizibil pentru utilizator (butonul), dar și „ok" simplu pentru
    // clienții one-click care nu randează HTML.
    return ok
      ? page(
          'Te-ai dezabonat',
          'Nu vei mai primi emailuri de la acest expeditor. Dacă a fost o greșeală, contactează direct persoana care ți-a scris.',
        )
      : page('Link invalid', 'Linkul de dezabonare nu este valid sau a expirat.')
  }

  // GET: NU mutăm. Validăm tokenul și arătăm o pagină cu buton de confirmare.
  const valid = await isValidToken(contactId, token)
  return valid
    ? confirmPage(contactId, token)
    : page('Link invalid', 'Linkul de dezabonare nu este valid sau a expirat.')
})
