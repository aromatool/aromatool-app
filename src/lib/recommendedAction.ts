import type { TFunction } from 'i18next'
import type { Contact } from './contactTypes.ts'
import type { ContactStatus } from './relationshipScore.ts'
import { INACTIVE_DAYS, REORDER_DAYS, DEFAULT_FOLLOWUP_DAYS } from './crmThresholds.ts'

// ── INTERVAL FOLLOW-UP CONFIGURABIL (din Settings) ───────────────────────────
// Modul pur, importabil și de Edge Functions. Pe CLIENT setăm o singură dată
// valoarea (useFollowUpDays → setFollowUpDays) și toate funcțiile pure o citesc
// ca default prin getFollowUpDays(). Pe SERVER (daily-focus, buclă pe mai mulți
// useri) NU ne bazăm pe starea de modul — pasăm followUpDays explicit per user.
let _followUpDays: number = DEFAULT_FOLLOWUP_DAYS
export function setFollowUpDays(days: number | null | undefined): void {
  const n = Number(days)
  _followUpDays = Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_FOLLOWUP_DAYS
}
export function getFollowUpDays(): number {
  return _followUpDays
}

// Tipul de acțiune — folosit intern pentru grupare/filtrare în Dashboard.
// Utilizatorul NU vede acest tip, doar textul acțiunii.
export type ActionType =
  | 'needs_offer'      // Trimite prima ofertă
  | 'needs_followup'   // Trimite follow-up (prospect cu ofertă)
  | 'first_order'      // Întâmpină clientul nou (post-achiziție)
  | 'reorder'          // Sugerează reaprovizionarea (nudge lunar)
  | 'awaiting_reply'   // Așteaptă răspuns
  | 'reactivate'       // Reactivează (inactiv / în risc / win-back)
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
  const then = new Date(iso)
  const ts = then.getTime()
  // Dată coruptă/neparsabilă → tratăm ca „necunoscut" (foarte vechi), nu NaN.
  if (!Number.isFinite(ts)) return 9999
  // Diferență pe zile calendaristice (miezul nopții local), nu timp brut scurs.
  const now = new Date()
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Dată în viitor (fus orar, ceas greșit) → 0, niciodată negativ.
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

const ACCENT = {
  red:    { accentBg: '#FFF0F4', accentColor: '#C94F6A' }, // urgent / risc
  amber:  { accentBg: '#FDF5EE', accentColor: '#C4906A' }, // de făcut de tine
  lav:    { accentBg: '#F0EEF8', accentColor: '#9888B8' }, // aștepți
  green:  { accentBg: '#E8F8F0', accentColor: '#2E8A58' }, // ok / oportunitate
  neutral:{ accentBg: '#F1EFE8', accentColor: '#888780' }, // niciun caz urgent
}

function firstName(name?: string | null): string {
  return (name ?? '').trim().split(' ')[0] ?? ''
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
function computeAction(c: Contact, followUpDays: number = getFollowUpDays()): ActionDescriptor {
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
      reasonParams: { count: lastActivity },
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }
  if (isClient && lastActivity >= INACTIVE_DAYS) {
    return {
      type: 'reactivate',
      titleKey: 'actions.title.contact', titleParams: { name },
      reasonKey: 'actions.reason.clientNotContacted', reasonParams: { count: lastActivity },
      priority: 'urgent',
      ...ACCENT.red, urgent: true,
    }
  }

  // 2. NECESITĂ OFERTĂ — prospect fără nicio ofertă
  if (totalOffers === 0 && (c.status === 'prospect' || c.status === 'in_followup')) {
    return {
      type: 'needs_offer',
      titleKey: 'actions.title.needsOffer',
      reasonKey: 'actions.reason.noOfferYet', reasonParams: { name, count: contactAge },
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // „Atingere" de făcut acum. Pentru data ultimului follow-up: dacă nu o știm
  // dar au existat follow-up-uri, folosim ultima activitate ca aproximare
  // (evităm valoarea 9999). Zile de la prima ofertă = când a plecat oferta.
  const effectiveFollowupRef = c.last_followup_at ?? (followupCount > 0 ? (c.last_activity_at ?? c.first_offer_at) : null)
  const daysSinceLastFollowup = effectiveFollowupRef ? daysSince(effectiveFollowupRef) : null
  const daysSinceOffer = daysSince(c.first_offer_at ?? c.last_activity_at)

  // CLIENT NOU: îl întâmpinăm IMEDIAT după achiziție (followupCount === 0), apoi
  // la fiecare interval de follow-up dacă n-am mai luat legătura. Întâmpinarea
  // post-cumpărare e binevenită imediat — nu o întârziem.
  const dueForClientTouch =
    !c.followup_opted_out &&
    (followupCount === 0 || (daysSinceLastFollowup !== null && daysSinceLastFollowup >= followUpDays))

  // PROSPECT: NU îl sâcâim imediat după prima ofertă — așteptăm `followUpDays`
  // de la momentul ofertei (poate nici n-a citit-o încă). Abia după ce trece
  // intervalul setat devine „follow-up de făcut". La follow-up-urile ulterioare
  // respectăm același interval de la ultimul contact.
  const dueForProspectFollowup =
    !c.followup_opted_out &&
    ((followupCount === 0 && daysSinceOffer >= followUpDays) ||
     (daysSinceLastFollowup !== null && daysSinceLastFollowup >= followUpDays))

  // 3. CLIENT NOU — întâmpinare post-achiziție (mulțumire / ghidare / „cum merge?")
  // Doar cât e proaspăt (sub pragul de reaprovizionare); după aceea intră pe reorder.
  if (c.status === 'client_nou' && totalOffers >= 1 && lastActivity < REORDER_DAYS && dueForClientTouch) {
    return {
      type: 'first_order',
      titleKey: 'actions.title.firstOrder', titleParams: { name },
      reasonKey: followupCount === 0 ? 'actions.reason.firstOrderNew' : 'actions.reason.firstOrderCheck',
      reasonParams: { name },
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // 4. NECESITĂ FOLLOW-UP — DOAR prospecți cu ofertă (clienții au flux propriu:
  // first_order / reorder). Follow-up-ul e de făcut dacă „atingerea" e datorată.
  if ((c.status === 'prospect' || c.status === 'in_followup') && totalOffers >= 1 && dueForProspectFollowup) {
    return {
      type: 'needs_followup',
      titleKey: 'actions.title.needsFollowup',
      reasonKey: followupCount === 0 ? 'actions.reason.followupNever' : 'actions.reason.followupLast',
      reasonParams: followupCount === 0 ? { name } : { name, count: daysSinceLastFollowup ?? 0 },
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // 5. REAPROVIZIONARE — client activ, ~30-60 zile de la ultima activitate.
  // Nudge lunar (aliniat cu comanda Loyalty Rewards), înainte de pragul de inactiv.
  if (isClient && lastActivity >= REORDER_DAYS && lastActivity < INACTIVE_DAYS) {
    return {
      type: 'reorder',
      titleKey: 'actions.title.reorder', titleParams: { name },
      reasonKey: 'actions.reason.reorder', reasonParams: { name, days: lastActivity },
      priority: 'attention',
      ...ACCENT.amber, urgent: true,
    }
  }

  // 6. DISCUTĂ BUSINESS — client implicat, candidat de echipă
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

  // 7. AȘTEAPTĂ RĂSPUNS — am luat legătura recent și e normal să aștepți.
  // Două cazuri: (a) follow-up trimis recent; (b) prospect TOCMAI ofertat, încă
  // în fereastra de așteptare, fără follow-up. Cazul (b) ar fi căzut altfel pe
  // „none" („La zi"), deși de fapt aștepți răspuns la ofertă.
  const sentFollowupRecently = followupCount >= 1 && daysSinceFollowup < followUpDays
  const freshOfferWaiting = followupCount === 0 && daysSinceOffer < followUpDays
  if (totalOffers >= 1 && (sentFollowupRecently || freshOfferWaiting)) {
    return {
      type: 'awaiting_reply',
      titleKey: 'actions.title.awaitingReply',
      reasonKey: sentFollowupRecently ? 'actions.reason.awaitingReply' : 'actions.reason.awaitingOfferReply',
      reasonParams: { count: sentFollowupRecently ? daysSinceFollowup : daysSinceOffer },
      priority: 'normal',
      ...ACCENT.lav, urgent: false,
    }
  }

  // 8. NIMIC URGENT
  return {
    type: 'none',
    titleKey: 'actions.title.none',
    reasonKey: c.status === 'team_member' ? 'actions.reason.noneTeam' : 'actions.reason.noneUpToDate',
    priority: 'normal',
    ...ACCENT.neutral, urgent: false,
  }
}

// Doar tipul acțiunii — fără a construi text (folosit de filtre/categorii).
export function getActionType(c: Contact, followUpDays: number = getFollowUpDays()): ActionType {
  return computeAction(c, followUpDays).type
}

/** Acțiunea recomandată cu text tradus (UI + email). */
export function getRecommendedAction(c: Contact, t: TFunction, followUpDays: number = getFollowUpDays()): RecommendedAction {
  const d = computeAction(c, followUpDays)
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
  'first_order',
  'needs_followup',
  'reorder',
  'discuss_business',
]

// Un contact "necesită atenție" dacă are o acțiune actionabilă acum.
// Aceeași sursă ca Focus Today — folosit și de filtrul CRM (?filter=needs_attention).
export function needsAttention(c: Contact, followUpDays: number = getFollowUpDays()): boolean {
  return ACTIONABLE_TYPES.includes(getActionType(c, followUpDays))
}

// ============================================================
// CATEGORII CRM — cele 4 categorii simple afișate în filtre.
// Mapăm cele 6 tipuri interne la 4 categorii (single source of truth).
// ============================================================
export type CrmCategory = 'offer' | 'followup' | 'reactivate' | 'none'

// Mapare tip intern → categorie CRM
export function crmCategory(c: Contact, followUpDays: number = getFollowUpDays()): CrmCategory {
  const type = getActionType(c, followUpDays)
  switch (type) {
    case 'needs_offer':       return 'offer'
    // first_order (întâmpinare client nou) și reorder (nudge lunar) sunt tot
    // „atingeri" proactive de trimis acum → intră în categoria follow-up.
    case 'needs_followup':
    case 'first_order':
    case 'reorder':           return 'followup'
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
export function shortReason(c: Contact, t: TFunction, followUpDays: number = getFollowUpDays()): string {
  const type = getActionType(c, followUpDays)
  const lastActivity = daysSince(c.last_activity_at ?? c.first_offer_at)
  const contactAge = daysSince(c.created_at)
  const followupCount = c.followup_count ?? 0
  // Referință corectă pentru ultimul follow-up (evită 9999)
  const fuRef = c.last_followup_at ?? (followupCount > 0 ? (c.last_activity_at ?? c.first_offer_at) : null)
  const daysSinceFollowup = fuRef ? daysSince(fuRef) : null

  switch (type) {
    case 'reactivate':
      // Sub 1 zi (ex. contact marcat manual „inactiv" azi) → „inactiv", nu „0 zile fără contact".
      return lastActivity >= 1 && lastActivity < 9999 ? t('actions.shortReason.daysNoContact', { count: lastActivity }) : t('actions.shortReason.inactive')
    case 'needs_offer':
      return contactAge <= 1 ? t('actions.shortReason.addedRecently') : t('actions.shortReason.inCrmNoOffer', { count: contactAge })
    case 'first_order':
      return followupCount === 0 ? t('actions.shortReason.firstOrderNew') : t('actions.shortReason.firstOrderCheck')
    case 'reorder':
      return t('actions.shortReason.reorder', { count: lastActivity })
    case 'needs_followup':
      return followupCount === 0
        ? t('actions.shortReason.notContactedAfterOffer')
        : daysSinceFollowup !== null ? t('actions.shortReason.lastFollowupDays', { count: daysSinceFollowup }) : t('actions.shortReason.followupToResume')
    case 'awaiting_reply': {
      // Prospect tocmai ofertat, încă fără follow-up → context: oferta, nu follow-up.
      if (followupCount === 0) {
        const dOffer = daysSince(c.first_offer_at ?? c.last_activity_at)
        return dOffer <= 0
          ? t('actions.shortReason.offerSentToday')
          : t('actions.shortReason.offerSentDaysAgo', { count: dOffer })
      }
      // „acum 0 zile" e greșit — un follow-up trimis azi se citește „follow-up azi".
      if (daysSinceFollowup === null) return t('actions.shortReason.waiting')
      return daysSinceFollowup === 0
        ? t('actions.shortReason.followupToday')
        : t('actions.shortReason.followupDaysAgo', { count: daysSinceFollowup })
    }
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
export function getNextAction(c: Contact, t: TFunction, followUpDays: number = getFollowUpDays()): NextAction | null {
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
  // Diferență pe zile calendaristice (miezul nopții local), nu timp brut.
  const now = new Date()
  const nd = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysUntil = Math.round((nd.getTime() - today.getTime()) / 86400000)

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