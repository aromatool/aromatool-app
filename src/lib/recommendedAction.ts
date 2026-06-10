import type { TFunction } from 'i18next'
import type { Contact } from './contactTypes.ts'
import type { ContactStatus } from './relationshipScore.ts'
import { INACTIVE_DAYS, FOLLOWUP_STALE_DAYS } from './crmThresholds.ts'

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

// Grupa de status afișată (cele 4 categorii curate). Pură, fără text —
// folosită pentru stilizare/filtrare fără a compara stringuri traduse.
export type StatusGroup = 'prospect' | 'client' | 'team' | 'inactive'
export function statusGroup(s: ContactStatus): StatusGroup {
  if (s === 'client_nou' || s === 'client_fidel') return 'client'
  if (s === 'team_member') return 'team'
  if (s === 'inactiv') return 'inactive'
  return 'prospect' // prospect, in_followup
}

// Status simplificat afișat utilizatorului (mapping din statusurile interne)
export function displayStatus(status: ContactStatus, t: TFunction): string {
  switch (status) {
    case 'prospect':     return t('actions.displayStatus.prospect')
    case 'in_followup':  return t('actions.displayStatus.prospect')   // în follow-up e tot un prospect, din perspectiva userului
    case 'client_nou':   return t('actions.displayStatus.client')
    case 'client_fidel': return t('actions.displayStatus.client')
    case 'team_member':  return t('actions.displayStatus.team_member')
    case 'inactiv':      return t('actions.displayStatus.inactiv')
    default:             return t('actions.displayStatus.contact')
  }
}

// Descriptor pur (fără text) — separă LOGICA de PREZENTARE.
// Conține cheile i18n + parametrii; textul se obține cu `t` în getRecommendedAction.
interface ActionDescriptor {
  type: ActionType
  titleKey: string
  titleParams?: Record<string, unknown>
  reasonKey: string
  reasonParams?: Record<string, unknown>
  priority: 'urgent' | 'attention' | 'normal'
  accentBg: string
  accentColor: string
  urgent: boolean
}

/**
 * Calculează SINGURA acțiune recomandată pentru un contact (descriptor pur).
 * Toată inteligența (risc, follow-up, business) e aici. Returnează chei i18n,
 * nu text — astfel `getActionType`/`needsAttention`/`crmCategory` nu au nevoie de `t`.
 * Ordinea de evaluare = ordinea de prioritate.
 */
function computeAction(c: Contact): ActionDescriptor {
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
      titleKey: 'actions.title.reactivate', titleParams: { name },
      reasonKey: lastActivity < 9999 ? 'actions.reason.inactiveDays' : 'actions.reason.inactiveMarked',
      reasonParams: { days: lastActivity },
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }
  if (isClient && lastActivity >= INACTIVE_DAYS) {
    return {
      type: 'reactivate',
      titleKey: 'actions.title.contact', titleParams: { name },
      reasonKey: 'actions.reason.clientNotContacted', reasonParams: { days: lastActivity },
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }

  // 2. NECESITĂ OFERTĂ — prospect fără nicio ofertă
  if (totalOffers === 0 && (c.status === 'prospect' || c.status === 'in_followup')) {
    return {
      type: 'needs_offer',
      titleKey: 'actions.title.needsOffer',
      reasonKey: 'actions.reason.noOfferYet', reasonParams: { name, days: contactAge },
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
      titleKey: 'actions.title.needsFollowup',
      reasonKey: followupCount === 0 ? 'actions.reason.followupNever' : 'actions.reason.followupLast',
      reasonParams: { name, days: daysSinceLastFollowup },
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
      titleKey: 'actions.title.discussBusiness',
      reasonKey: 'actions.reason.discussBusiness',
      priority: 'normal',
      ...ACCENT.green, urgent: false,
    }
  }

  // 5. AȘTEAPTĂ RĂSPUNS — follow-up recent, fără răspuns
  if (totalOffers >= 1 && followupCount >= 1 && daysSinceFollowup < FOLLOWUP_STALE_DAYS) {
    return {
      type: 'awaiting_reply',
      titleKey: 'actions.title.awaitingReply',
      reasonKey: 'actions.reason.awaitingReply', reasonParams: { days: daysSinceFollowup },
      priority: 'normal',
      ...ACCENT.lav, urgent: false,
    }
  }

  // 6. NIMIC URGENT
  return {
    type: 'none',
    titleKey: 'actions.title.none',
    reasonKey: c.status === 'team_member' ? 'actions.reason.noneTeam' : 'actions.reason.noneUpToDate',
    priority: 'normal',
    ...ACCENT.neutral, urgent: false,
  }
}

// Doar tipul acțiunii — fără a construi text (folosit de filtre/categorii).
export function getActionType(c: Contact): ActionType {
  return computeAction(c).type
}

/** Acțiunea recomandată cu text tradus (UI + email). */
export function getRecommendedAction(c: Contact, t: TFunction): RecommendedAction {
  const d = computeAction(c)
  return {
    type: d.type,
    title: t(d.titleKey, d.titleParams),
    reason: t(d.reasonKey, d.reasonParams),
    priority: d.priority,
    accentBg: d.accentBg,
    accentColor: d.accentColor,
    urgent: d.urgent,
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
  return ACTIONABLE_TYPES.includes(getActionType(c))
}

// ============================================================
// CATEGORII CRM — cele 4 categorii simple afișate în filtre.
// Mapăm cele 6 tipuri interne la 4 categorii (single source of truth).
// ============================================================
export type CrmCategory = 'offer' | 'followup' | 'reactivate' | 'none'

// Mapare tip intern → categorie CRM
export function crmCategory(c: Contact): CrmCategory {
  const type = getActionType(c)
  switch (type) {
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

// Etichete umane pentru categoriile CRM (traduse)
export function crmCategoryLabels(t: TFunction): Record<CrmCategory, string> {
  return {
    offer: t('actions.crmCategory.offer'),
    followup: t('actions.crmCategory.followup'),
    reactivate: t('actions.crmCategory.reactivate'),
    none: t('actions.crmCategory.none'),
  }
}

// Motiv scurt pentru afișare pe card (mai compact decât reason)
export function shortReason(c: Contact, t: TFunction): string {
  const type = getActionType(c)
  const lastActivity = daysSince(c.last_activity_at ?? c.first_offer_at)
  const contactAge = daysSince(c.created_at)
  const followupCount = c.followup_count ?? 0
  // Referință corectă pentru ultimul follow-up (evită 9999)
  const fuRef = c.last_followup_at ?? (followupCount > 0 ? (c.last_activity_at ?? c.first_offer_at) : null)
  const daysSinceFollowup = fuRef ? daysSince(fuRef) : null

  switch (type) {
    case 'reactivate':
      return lastActivity < 9999 ? t('actions.shortReason.daysNoContact', { days: lastActivity }) : t('actions.shortReason.inactive')
    case 'needs_offer':
      return contactAge <= 1 ? t('actions.shortReason.addedRecently') : t('actions.shortReason.inCrmNoOffer', { days: contactAge })
    case 'needs_followup':
      return followupCount === 0
        ? t('actions.shortReason.notContactedAfterOffer')
        : daysSinceFollowup !== null ? t('actions.shortReason.lastFollowupDays', { days: daysSinceFollowup }) : t('actions.shortReason.followupToResume')
    case 'awaiting_reply':
      return daysSinceFollowup !== null ? t('actions.shortReason.followupDaysAgo', { days: daysSinceFollowup }) : t('actions.shortReason.waiting')
    case 'discuss_business':
      return t('actions.shortReason.engagedClient')
    default:
      return t('actions.shortReason.upToDate')
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

/**
 * Următoarea acțiune VIITOARE (de mâine încolo).
 * Returnează null dacă acțiunea e azi/restantă (rămâne în „Necesită atenția acum")
 * sau dacă nu există o acțiune viitoare relevantă.
 */
export function getNextAction(c: Contact, t: TFunction, followUpDays: number = 5): NextAction | null {
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
    description: t(`actions.nextAction.${type}`),
  }
}

// Grupare temporală umană
export function groupLabel(date: Date, daysUntil: number, t: TFunction): string {
  if (daysUntil === 1) return t('actions.group.tomorrow')
  if (daysUntil <= 6) {
    const locale = t('actions.localeCode')
    const zi = date.toLocaleDateString(locale, { weekday: 'long' })
    const dataScurta = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return `${zi.charAt(0).toUpperCase() + zi.slice(1)}, ${dataScurta}`
  }
  if (daysUntil <= 13) return t('actions.group.nextWeek')
  return t('actions.group.later')
}