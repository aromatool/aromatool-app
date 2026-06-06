import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Opțional: secretul de signing din Resend Dashboard → Webhooks
const RESEND_WEBHOOK_SECRET      = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
}

// ─── VERIFICARE SEMNĂTURĂ SVIX (opțional) ────────────────────
// Resend folosește Svix pentru webhook signing.
// Dacă RESEND_WEBHOOK_SECRET este setat, verificăm semnătura.
async function verifySignature(req: Request, body: string): Promise<boolean> {
  if (!RESEND_WEBHOOK_SECRET) return true // skip dacă nu e configurat

  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Format mesaj: svixId.svixTimestamp.body
  const signedContent = `${svixId}.${svixTimestamp}.${body}`

  // Decodifică secretul (format: whsec_...)
  const secret = RESEND_WEBHOOK_SECRET.startsWith('whsec_')
    ? RESEND_WEBHOOK_SECRET.slice(6)
    : RESEND_WEBHOOK_SECRET

  const keyData = Uint8Array.from(atob(secret), c => c.charCodeAt(0))
  const key     = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const computed       = `v1,${btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))}`

  // svix-signature poate conține multiple semnături separate prin spații
  const expectedSigs = svixSignature.split(' ')
  return expectedSigs.some(sig => sig === computed)
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────
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
    const rawBody = await req.text()

    // Verificare semnătură
    const valid = await verifySignature(req, rawBody)
    if (!valid) {
      console.error('Resend webhook: invalid signature')
      return json({ error: 'Invalid signature' }, 401)
    }

    const payload = JSON.parse(rawBody)
    const eventType: string = payload?.type ?? ''

    console.log('Resend webhook event:', eventType, JSON.stringify(payload).slice(0, 200))

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ── HELPER: extrage email destinatar ────────────────────
    function extractEmail(p: Record<string, unknown>): string | null {
      const data = p?.data as Record<string, unknown> | null
      if (!data) return null
      // contact.unsubscribed → data.email
      if (typeof data.email === 'string') return data.email
      // email.* events → data.to (string sau array)
      const to = data.to
      if (Array.isArray(to)) return to[0] ?? null
      if (typeof to === 'string') return to
      return null
    }

    // ── OPT-OUT: DEZABONARE / RECLAMAȚIE / BOUNCE ───────────
    //   contact.unsubscribed  — click pe unsubscribe link
    //   email.complained      — marcat ca spam
    //   email.bounced         — hard bounce (adresă inexistentă)
    const OPT_OUT_EVENTS = ['contact.unsubscribed', 'email.complained', 'email.bounced']

    if (OPT_OUT_EVENTS.includes(eventType)) {
      const email = extractEmail(payload)

      if (!email) {
        console.warn('Resend webhook: no email in payload', JSON.stringify(payload))
        return json({ ok: true, skipped: 'no email in payload' })
      }

      const { data: updated, error: updateError } = await supabase
        .from('contacts')
        .update({
          email_opt_out: true,
          email_opt_out_at: new Date().toISOString(),
        })
        .eq('email', email)
        .select('id')

      if (updateError) {
        console.error('Resend webhook: opt-out update error', updateError)
        return json({ error: updateError.message }, 500)
      }

      const affectedIds = (updated ?? []).map((c: { id: string }) => c.id)
      console.log(`Resend webhook: email_opt_out set for ${affectedIds.length} contact(s) — ${email}`)

      await supabase.from('webhook_log').insert({
        source: 'resend',
        event_type: eventType,
        payload,
        contact_id: affectedIds[0] ?? null,
        notes: `email_opt_out=true pt ${email} (${affectedIds.length} contacte)`,
      })

      return json({ ok: true, affected: affectedIds.length, email })
    }

    // ── EMAIL OPENED ─────────────────────────────────────────
    if (eventType === 'email.opened') {
      const email = extractEmail(payload)
      if (email) {
        // Incrementează email_opens pentru toate contactele cu această adresă
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, email_opens')
          .eq('email', email)

        for (const contact of (contacts ?? [])) {
          await supabase
            .from('contacts')
            .update({ email_opens: (contact.email_opens ?? 0) + 1 })
            .eq('id', contact.id)
        }

        const affected = (contacts ?? []).length
        console.log(`Resend webhook: email_opens++ for ${affected} contact(s) — ${email}`)

        await supabase.from('webhook_log').insert({
          source: 'resend',
          event_type: eventType,
          payload,
          contact_id: (contacts ?? [])[0]?.id ?? null,
          notes: `email deschis de ${email}`,
        })

        return json({ ok: true, event: 'email.opened', email, affected })
      }
      return json({ ok: true, skipped: 'no email in payload' })
    }

    // ── EMAIL CLICKED ────────────────────────────────────────
    if (eventType === 'email.clicked') {
      const email = extractEmail(payload)
      if (email) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, email_clicks')
          .eq('email', email)

        for (const contact of (contacts ?? [])) {
          await supabase
            .from('contacts')
            .update({ email_clicks: (contact.email_clicks ?? 0) + 1 })
            .eq('id', contact.id)
        }

        const affected = (contacts ?? []).length
        console.log(`Resend webhook: email_clicks++ for ${affected} contact(s) — ${email}`)

        await supabase.from('webhook_log').insert({
          source: 'resend',
          event_type: eventType,
          payload,
          contact_id: (contacts ?? [])[0]?.id ?? null,
          notes: `link apăsat de ${email}`,
        })

        return json({ ok: true, event: 'email.clicked', email, affected })
      }
      return json({ ok: true, skipped: 'no email in payload' })
    }

    // ── ALTE EVENTS (logăm, nu facem nimic) ─────────────────
    await supabase.from('webhook_log').insert({
      source: 'resend',
      event_type: eventType,
      payload,
      notes: 'unhandled event type',
    })

    return json({ ok: true, message: `Event '${eventType}' received but not handled` })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Resend webhook error:', message)
    return json({ error: message }, 500)
  }
})
