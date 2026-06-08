import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================
// UNSUBSCRIBE — dezabonare destinatar (conformitate email UE).
// Link semnat în fiecare email: setează email_opt_out = true pe
// contact. Suportă:
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

// Calculează HMAC-SHA256(contactId) → hex. Trebuie identic cu send-email.
async function sign(contactId: string): Promise<string> {
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

// Comparație în timp constant (evită timing attacks).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="ro"><head><meta charset="utf-8">
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

async function doUnsubscribe(contactId: string, token: string): Promise<boolean> {
  if (!contactId || !token || !UNSUB_SECRET) return false
  const expected = await sign(contactId)
  if (!safeEqual(token, expected)) return false
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await supabase
    .from('contacts')
    .update({ email_opt_out: true })
    .eq('id', contactId)
  return !error
}

serve(async (req) => {
  const url = new URL(req.url)
  const contactId = url.searchParams.get('c') || ''
  const token = url.searchParams.get('t') || ''

  // One-click (RFC 8058): Gmail/Yahoo trimit POST fără interacțiune.
  if (req.method === 'POST') {
    const ok = await doUnsubscribe(contactId, token)
    return new Response(ok ? 'ok' : 'error', { status: ok ? 200 : 400 })
  }

  // GET: confirmare vizibilă pentru destinatar.
  const ok = await doUnsubscribe(contactId, token)
  return ok
    ? page(
        'Te-ai dezabonat',
        'Nu vei mai primi emailuri de la acest expeditor. Dacă a fost o greșeală, contactează direct persoana care ți-a scris.',
      )
    : page(
        'Link invalid',
        'Linkul de dezabonare nu este valid sau a expirat.',
      )
})
