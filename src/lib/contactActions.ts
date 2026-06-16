import type { Contact } from '../pages/DashboardPage'
import { INACTIVE_DAYS } from './crmThresholds'

// Normalizează un număr pentru wa.me (cifre, cu prefix de țară, fără „+").
// Reguli (în ordine), ca să NU stricăm numerele internaționale:
//   • „+40…" / „+44…"  → păstrăm cifrele așa cum sunt (deja are prefix).
//   • „0040…" / „00…"  → prefix internațional „00" → îl eliminăm.
//   • „07…" (național, un singur 0 la început) → înlocuim 0 cu prefixul implicit.
//   • orice altceva → presupunem că include deja prefixul de țară.
// `defaultDial` = prefixul țării distribuitorului (implicit „40" = România).
export function normalizePhone(phone?: string, defaultDial = '40'): string {
  if (!phone) return ''
  const hadPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/[^0-9]/g, '')
  if (!digits) return ''
  if (hadPlus) return digits                 // +40…/+44… → cifrele ca atare
  if (digits.startsWith('00')) return digits.slice(2) // 0040… → 40…
  if (digits.startsWith('0')) return defaultDial + digits.slice(1) // 07… → 407…
  return digits
}

export function firstName(name?: string | null): string {
  return (name ?? '').trim().split(' ')[0] ?? ''
}

// Salutul WhatsApp, în limba contactului (RO implicit, EN dacă language_code === 'en').
// Dicționar self-contained, ca să nu depindem de i18next în lib-uri pure — același
// pattern ca EMAIL_TEXT din follow-up. Cheia = situația contactului.
type WaKind = 'reactivate' | 'firstOffer' | 'followup' | 'generic'

const WA_TEXT: Record<'ro' | 'en', Record<WaKind, (nume: string) => string>> = {
  ro: {
    reactivate: (n) => `Bună ${n}! 🌿\n\nMi-am amintit de tine și voiam să te întreb cum te mai simți. Dacă ai nevoie de ceva sau vrei să reîncerci ceva din produse, sunt aici cu drag!`,
    firstOffer: (n) => `Bună ${n}! 🌿\n\nMă bucur că ne-am cunoscut. Dacă vrei, îți pot pregăti o ofertă personalizată cu produsele care ți se potrivesc cel mai bine. Spune-mi ce te interesează!`,
    followup: (n) => `Bună ${n}! 🌿\n\nVoiam doar să verific dacă ai apucat să te uiți peste oferta pe care ți-am trimis-o. Sunt aici pentru orice întrebare!`,
    generic: (n) => `Bună ${n}! 🌿\n\nCe mai faci? Sunt aici dacă ai nevoie de ceva sau vrei să discutăm despre produse.`,
  },
  en: {
    reactivate: (n) => `Hi ${n}! 🌿\n\nYou crossed my mind and I wanted to check in on how you're doing. If you need anything or want to give the products another try, I'm here and happy to help!`,
    firstOffer: (n) => `Hi ${n}! 🌿\n\nLovely meeting you. If you'd like, I can put together a personalised offer with the products that suit you best. Just let me know what you're interested in!`,
    followup: (n) => `Hi ${n}! 🌿\n\nJust wanted to check whether you had a chance to look over the offer I sent you. I'm here for any questions!`,
    generic: (n) => `Hi ${n}! 🌿\n\nHow are you? I'm here if you need anything or would like to chat about the products.`,
  },
}

export function buildWhatsAppGreeting(contact: Contact, senderName?: string): string {
  const nume = firstName(contact.name)
  const lang = contact.language_code === 'en' ? 'en' : 'ro'
  const daysSinceActivity = contact.last_activity_at
    ? (() => {
        const then = new Date(contact.last_activity_at)
        const now = new Date()
        const a = new Date(then.getFullYear(), then.getMonth(), then.getDate())
        const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
      })()
    : null

  let kind: WaKind
  if (contact.status === 'inactiv' || (daysSinceActivity !== null && daysSinceActivity >= INACTIVE_DAYS)) {
    kind = 'reactivate'
  } else if (contact.status === 'prospect' && (contact.offers_count ?? 0) === 0) {
    kind = 'firstOffer'
  } else if (contact.status === 'in_followup') {
    kind = 'followup'
  } else {
    kind = 'generic'
  }

  let msg = WA_TEXT[lang][kind](nume)
  if (senderName) {
    msg += `\n\n— ${senderName}`
  }
  return msg
}

export function openWhatsApp(contact: Contact, senderName?: string): void {
  const phone = normalizePhone(contact.phone)
  const msg = buildWhatsAppGreeting(contact, senderName)
  const encoded = encodeURIComponent(msg)
  const url = phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
  window.open(url, '_blank')
}

export function startOffer(
  contact: Contact,
  _setPrefillContactId: (id: string) => void,
  navigate: (path: string) => void
): void {
  try {
    sessionStorage.setItem('prefill_contact', JSON.stringify({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      language: contact.language_code ?? 'ro',
    }))
  } catch {
    // sessionStorage indisponibil
  }
  navigate('/app/calculator')
}