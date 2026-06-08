import type { Contact } from './contactTypes.ts'
import type { ContactStatus } from './relationshipScore.ts'

// Tipul de acțiune — folosit intern pentru grupare/filtrare în Dashboard.
// Utilizatorul NU vede acest tip, doar textul acțiunii.
export type ActionType =
  | 'needs_offer'      // Trimite prima ofertă
  | 'needs_followup'   // Trimite follow-up
  | 'awaiting_reply'   // Așteaptă răspuns
  | 'reactivate'       // Reactivează (inactiv / în risc)
  | 'discuss_business' // Discută despre business
  | 'none'             // Nicio acțiune necesară

export interface RecommendedAction {
  type: ActionType
  title: string        // Ce trebuie făcut: "Contactează Daniela"
  reason: string       // De ce: "Nu a mai fost contactată de 75 zile."
  // Nivel de gravitate pentru evidențiere vizuală
  priority: 'urgent' | 'attention' | 'normal'
  // Stil vizual pentru accentul de urgență (avatar, bordură subtilă)
  accentBg: string
  accentColor: string
  // Există o acțiune urgentă reală? (pentru sortare/Focus Today)
  urgent: boolean
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

const FOLLOWUP_STALE_DAYS = 7

const ACCENT = {
  red:    { accentBg: '#FFF0F4', accentColor: '#C94F6A' }, // urgent / risc
  amber:  { accentBg: '#FDF5EE', accentColor: '#C4906A' }, // de făcut de tine
  lav:    { accentBg: '#F0EEF8', accentColor: '#9888B8' }, // aștepți
  green:  { accentBg: '#E8F8F0', accentColor: '#2E8A58' }, // ok / oportunitate
  neutral:{ accentBg: '#F1EFE8', accentColor: '#888780' }, // niciun caz urgent
}

function firstName(name: string): string {
  return name.split(' ')[0]
}

// Status simplificat afișat utilizatorului (mapping din statusurile interne)
export function displayStatus(status: ContactStatus): string {
  switch (status) {
    case 'prospect':     return 'Prospect'
    case 'in_followup':  return 'Prospect'   // în follow-up e tot un prospect, din perspectiva userului
    case 'client_nou':   return 'Client'
    case 'client_fidel': return 'Client'
    case 'team_member':  return 'Membru echipă'
    case 'inactiv':      return 'Inactiv'
    default:             return 'Contact'
  }
}

/**
 * Calculează SINGURA acțiune recomandată pentru un contact.
 * Toată inteligența (risc, follow-up, business) e aici, dar rezultatul
 * e o singură concluzie clară, nu o listă de badge-uri.
 * Ordinea de evaluare = ordinea de prioritate.
 */
export function getRecommendedAction(c: Contact): RecommendedAction {
  const name = firstName(c.name)
  const totalOffers = c.offers_count ?? 0
  const totalValue = c.total_eur ?? 0
  const contactAge = daysSince(c.created_at)
  const lastActivity = daysSince(c.last_activity_at ?? c.first_offer_at)
  const followupCount = c.followup_count ?? 0
  const daysSinceFollowup = daysSince(c.last_followup_at)
  const isClient = c.status === 'client_nou' || c.status === 'client_fidel'

  // 1. REACTIVARE — inactiv sau client fără contact de mult
  if (c.status === 'inactiv') {
    return {
      type: 'reactivate',
      title: `Reactivează ${name}`,
      reason: lastActivity < 9999
        ? `Inactiv de ${lastActivity} zile. Un mesaj cald poate readuce relația.`
        : 'Marcat inactiv. Încearcă o reconectare.',
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }
  if (isClient && lastActivity > 60) {
    return {
      type: 'reactivate',
      title: `Contactează ${name}`,
      reason: `Nu a mai fost contactat de ${lastActivity} zile.`,
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }

  // 2. NECESITĂ OFERTĂ — prospect fără nicio ofertă
  if (totalOffers === 0 && (c.status === 'prospect' || c.status === 'in_followup')) {
    return {
      type: 'needs_offer',
      title: `Trimite prima ofertă`,
      reason: `${name} nu a primit încă nicio ofertă. E în CRM de ${contactAge} zile.`,
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // 3. NECESITĂ FOLLOW-UP — are ofertă, dar follow-up-ul e de făcut
  // Pentru data ultimului follow-up: dacă nu o știm dar au existat follow-up-uri,
  // folosim ultima activitate ca aproximare (evităm valoarea 9999).
  const effectiveFollowupRef = c.last_followup_at ?? (followupCount > 0 ? (c.last_activity_at ?? c.first_offer_at) : null)
  const daysSinceLastFollowup = effectiveFollowupRef ? daysSince(effectiveFollowupRef) : null
  const needsFollowup =
    totalOffers >= 1 &&
    !c.followup_opted_out &&
    (followupCount === 0 || (daysSinceLastFollowup !== null && daysSinceLastFollowup >= FOLLOWUP_STALE_DAYS))
  if (needsFollowup) {
    return {
      type: 'needs_followup',
      title: `Trimite follow-up`,
      reason: followupCount === 0
        ? `${name} a primit ofertă, dar n-a fost contactat de atunci.`
        : `Ultimul follow-up acum ${daysSinceLastFollowup} zile.`,
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // 4. DISCUTĂ BUSINESS — client implicat, candidat de echipă
  const businessSignals = [
    isClient,
    totalOffers >= 3,
    totalValue >= 300,
    contactAge >= 120,
    lastActivity < 45,
    c.manual_business_interest === true,
  ].filter(Boolean).length
  if (isClient && businessSignals >= 4) {
    return {
      type: 'discuss_business',
      title: `Discută despre business`,
      reason: `Client activ și implicat de peste 4 luni. Poate fi interesat de oportunitate.`,
      priority: 'normal',
      ...ACCENT.green, urgent: false,
    }
  }

  // 5. AȘTEAPTĂ RĂSPUNS — follow-up recent, fără răspuns
  if (totalOffers >= 1 && followupCount >= 1 && daysSinceFollowup < FOLLOWUP_STALE_DAYS) {
    return {
      type: 'awaiting_reply',
      title: `Așteaptă răspuns`,
      reason: `Follow-up trimis acum ${daysSinceFollowup} zile. Lasă-i timp sau trimite un mesaj scurt.`,
      priority: 'normal',
      ...ACCENT.lav, urgent: false,
    }
  }

  // 6. NIMIC URGENT
  return {
    type: 'none',
    title: 'Nicio acțiune necesară',
    reason: c.status === 'team_member'
      ? 'Activ și implicat.'
      : 'Totul e la zi cu acest contact.',
    priority: 'normal',
    ...ACCENT.neutral, urgent: false,
  }
}

// Acțiunile considerate "de făcut azi" (pentru Focus Today + grupare Dashboard)
export const ACTIONABLE_TYPES: ActionType[] = [
  'reactivate',
  'needs_offer',
  'needs_followup',
  'discuss_business',
]

// Un contact "necesită atenție" dacă are o acțiune actionabilă acum.
// Aceeași sursă ca Focus Today — folosit și de filtrul CRM (?filter=needs_attention).
export function needsAttention(c: Contact): boolean {
  return ACTIONABLE_TYPES.includes(getRecommendedAction(c).type)
}

// ============================================================
// CATEGORII CRM — cele 4 categorii simple afișate în filtre.
// Mapăm cele 6 tipuri interne la 4 categorii (single source of truth).
// ============================================================
export type CrmCategory = 'offer' | 'followup' | 'reactivate' | 'none'

// Mapare tip intern → categorie CRM
export function crmCategory(c: Contact): CrmCategory {
  const t = getRecommendedAction(c).type
  switch (t) {
    case 'needs_offer':       return 'offer'
    case 'needs_followup':    return 'followup'
    case 'reactivate':        return 'reactivate'
    // awaiting_reply (follow-up trimis recent), discuss_business și none
    // = nicio acțiune presantă pentru user → "Fără acțiuni"
    case 'awaiting_reply':
    case 'discuss_business':
    case 'none':
    default:                  return 'none'
  }
}

// Etichete umane pentru categoriile CRM
export const CRM_CATEGORY_LABEL: Record<CrmCategory, string> = {
  offer: 'Necesită ofertă',
  followup: 'Necesită follow-up',
  reactivate: 'Necesită reactivare',
  none: 'Fără acțiuni',
}

// Motiv scurt pentru afișare pe card (mai compact decât reason)
export function shortReason(c: Contact): string {
  const action = getRecommendedAction(c)
  const lastActivity = daysSince(c.last_activity_at ?? c.first_offer_at)
  const contactAge = daysSince(c.created_at)
  const followupCount = c.followup_count ?? 0
  // Referință corectă pentru ultimul follow-up (evită 9999)
  const fuRef = c.last_followup_at ?? (followupCount > 0 ? (c.last_activity_at ?? c.first_offer_at) : null)
  const daysSinceFollowup = fuRef ? daysSince(fuRef) : null

  switch (action.type) {
    case 'reactivate':
      return lastActivity < 9999 ? `${lastActivity} zile fără contact` : 'inactiv'
    case 'needs_offer':
      return contactAge <= 1 ? 'adăugat recent' : `în CRM de ${contactAge} zile, fără ofertă`
    case 'needs_followup':
      return followupCount === 0
        ? 'Nu a fost contactat după ofertă'
        : daysSinceFollowup !== null ? `ultimul acum ${daysSinceFollowup} zile` : 'follow-up de reluat'
    case 'awaiting_reply':
      return daysSinceFollowup !== null ? `follow-up acum ${daysSinceFollowup} zile` : 'în așteptare'
    case 'discuss_business':
      return 'client implicat'
    default:
      return 'la zi'
  }
}

// ============================================================
// AGENDA SĂPTĂMÂNII — acțiuni viitoare (de mâine încolo)
// ============================================================

export type NextActionType =
  | 'offer_followup'
  | 'first_order_followup'
  | 'reactivation'
  | 'business_opportunity'
  | 'contact_prospect'

export interface NextAction {
  contact: Contact
  date: Date
  daysUntil: number
  type: NextActionType
  description: string
}

const NEXT_ACTION_DESC: Record<NextActionType, string> = {
  offer_followup: 'Întreabă dacă a analizat oferta',
  first_order_followup: 'Verifică experiența după prima comandă',
  reactivation: 'Încearcă reactivarea',
  business_opportunity: 'Discută despre oportunitatea de business',
  contact_prospect: 'Ia legătura cu prospectul',
}

/**
 * Următoarea acțiune VIITOARE (de mâine încolo).
 * Returnează null dacă acțiunea e azi/restantă (rămâne în „Necesită atenția acum")
 * sau dacă nu există o acțiune viitoare relevantă.
 */
export function getNextAction(c: Contact, followUpDays: number = 5): NextAction | null {
  const lastActivity = c.last_activity_at ?? c.first_offer_at
  const totalOffers = c.offers_count ?? 0
  const isClient = c.status === 'client_nou' || c.status === 'client_fidel'

  // Inactivii = acțiune ACUM, stau în pasul 1
  if (c.status === 'inactiv') return null

  let type: NextActionType
  let baseDate: Date

  if (totalOffers === 0 && (c.status === 'prospect' || c.status === 'in_followup')) {
    type = 'contact_prospect'
    baseDate = new Date(c.created_at)
  } else if (totalOffers >= 1 && lastActivity) {
    type = c.status === 'client_nou' ? 'first_order_followup' : 'offer_followup'
    baseDate = new Date(c.last_followup_at ?? lastActivity)
  } else if (isClient) {
    type = 'business_opportunity'
    baseDate = new Date(lastActivity ?? c.created_at)
  } else {
    return null
  }

  const nextDate = new Date(baseDate.getTime() + followUpDays * 86400000)
  const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / 86400000)

  // Doar viitor. Azi/restant (daysUntil < 1) rămâne în pasul 1.
  if (daysUntil < 1) return null

  return {
    contact: c,
    date: nextDate,
    daysUntil,
    type,
    description: NEXT_ACTION_DESC[type],
  }
}

// Grupare temporală umană
export function groupLabel(date: Date, daysUntil: number): string {
  if (daysUntil === 1) return 'Mâine'
  if (daysUntil <= 6) {
    const zi = date.toLocaleDateString('ro-RO', { weekday: 'long' })
    const dataScurta = date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
    return `${zi.charAt(0).toUpperCase() + zi.slice(1)}, ${dataScurta}`
  }
  if (daysUntil <= 13) return 'Săptămâna viitoare'
  return 'Mai târziu'
}