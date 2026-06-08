// ── Config link resurse ──────────────────────────────────────
// Baza URL pentru linkurile de resurse din emailuri.
//
// ACUM (fără domeniu propriu): folosim Edge Function-ul Supabase.
//   {SUPABASE_URL}/functions/v1/resource-redirect/{token}
//
// CÂND IEI DOMENIUL: setezi VITE_RESOURCE_LINK_BASE = "https://app.aromatool.com/r"
//   și nu mai trebuie schimbat nimic în cod — un singur env var.
//
// Astfel migrarea pe domeniu = o variabilă, fără refactor.

const ENV_BASE = import.meta.env.VITE_RESOURCE_LINK_BASE as string | undefined
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

function defaultBase(): string {
  // ex: https://kbtstoqrukxwnhpuvglv.supabase.co/functions/v1/resource-redirect
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/resource-redirect`
}

export function buildResourceUrl(token: string): string {
  const base = (ENV_BASE && ENV_BASE.trim()) || defaultBase()
  return `${base.replace(/\/$/, '')}/${token}`
}

// ── Generare linkuri securizate per resursă ──────────────────
// Validează proprietatea, creează câte un rând `resource_links` cu token
// per resursă deținută și întoarce id-ul (pentru cleanup/legare ulterioară),
// titlul și URL-ul de redirect. Folosit la ofertă (useSendEmail) și la
// mesajele de follow-up (FollowupModal) — o singură sursă de adevăr.
import { supabase } from './supabase'

export interface CreatedResourceLink {
  id: string
  token: string
  title: string
  url: string
}

export async function createResourceLinks(
  userId: string,
  resourceIds: string[],
  contactId?: string | null,
): Promise<CreatedResourceLink[]> {
  if (!resourceIds || resourceIds.length === 0) return []

  // Validăm proprietatea + luăm titlurile (RLS owner-only oricum, dar explicit)
  const { data: owned } = await supabase
    .from('resources')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', resourceIds)

  const created: CreatedResourceLink[] = []
  for (const res of owned ?? []) {
    const token = crypto.randomUUID()
    const { data: row } = await supabase
      .from('resource_links')
      .insert({
        resource_id: res.id,
        user_id: userId,
        contact_id: contactId || null,
        token,
      })
      .select('id')
      .single()
    if (row) {
      created.push({ id: row.id, token, title: res.title, url: buildResourceUrl(token) })
    }
  }
  return created
}
