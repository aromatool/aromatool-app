import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SIGNED_URL_TTL            = 60 // secunde — fereastră scurtă, regenerat la fiecare click

// ─── REDIRECT PUBLIC PENTRU RESURSE ──────────────────────────
// URL: {BASE}/functions/v1/resource-redirect/{token}
//      sau .../resource-redirect?t={token}
//
// Fluxul (cost-optimizat):
//   1. extrage tokenul
//   2. caută link-ul → resursa → file_path
//   3. loghează accesarea (clicked_at, click_count++)
//   4. 302 redirect către un signed URL cu TTL scurt
// Bytes-ii fișierului curg Storage→client DIRECT (un singur egress);
// funcția face doar un redirect minuscul.
serve(async (req) => {
  try {
    const url = new URL(req.url)

    // token din path (.../resource-redirect/{token}) sau din ?t=
    const parts = url.pathname.split('/').filter(Boolean)
    const tokenFromPath = parts[parts.length - 1]
    const token =
      (tokenFromPath && tokenFromPath !== 'resource-redirect')
        ? tokenFromPath
        : (url.searchParams.get('t') ?? '')

    if (!token) {
      return new Response('Link invalid.', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Rezolvă token → link → resursă (două query-uri explicite, fără embed)
    const { data: link, error: linkErr } = await supabase
      .from('resource_links')
      .select('id, resource_id')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) {
      console.error('resource-redirect: link lookup', linkErr)
      return new Response('Resursa nu a fost găsită sau linkul a expirat.', { status: 404 })
    }

    const { data: resource, error: resErr } = await supabase
      .from('resources')
      .select('file_path')
      .eq('id', link.resource_id)
      .maybeSingle()

    const filePath = resource?.file_path
    if (resErr || !filePath) {
      console.error('resource-redirect: resource lookup', resErr)
      return new Response('Fișierul nu mai există.', { status: 404 })
    }

    // 2. Loghează accesarea (best-effort, nu blocăm livrarea)
    try {
      await supabase.rpc('touch_resource_link', { p_token: token })
    } catch (_) {
      // ignorăm — logarea nu trebuie să blocheze servirea fișierului
    }

    // 3. Generează signed URL cu TTL scurt
    const { data: signed, error: signErr } = await supabase
      .storage
      .from('resources')
      .createSignedUrl(filePath, SIGNED_URL_TTL)

    if (signErr || !signed?.signedUrl) {
      console.error('resource-redirect: sign error', signErr)
      return new Response('Nu am putut genera linkul fișierului.', { status: 500 })
    }

    // 4. Redirect 302 — fișierul se servește direct din Storage
    return new Response(null, {
      status: 302,
      headers: {
        Location: signed.signedUrl,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('resource-redirect error:', err)
    return new Response('Eroare internă.', { status: 500 })
  }
})
