import type { Contact } from '../pages/DashboardPage'

export function normalizePhone(phone?: string): string {
  if (!phone) return ''
  return phone.replace(/[^0-9]/g, '').replace(/^0/, '40')
}

export function firstName(name: string): string {
  return name.split(' ')[0]
}

export function buildWhatsAppGreeting(contact: Contact, senderName?: string): string {
  const nume = firstName(contact.name)
  const daysSinceActivity = contact.last_activity_at
    ? Math.floor((Date.now() - new Date(contact.last_activity_at).getTime()) / 86400000)
    : null

  let msg: string

  if (contact.status === 'inactiv' || (daysSinceActivity !== null && daysSinceActivity >= 60)) {
    msg = `Bună ${nume}! 🌿\n\nMi-am amintit de tine și voiam să te întreb cum te mai simți. Dacă ai nevoie de ceva sau vrei să reîncerci ceva din produse, sunt aici cu drag!`
  } else if (contact.status === 'prospect' && (contact.offers_count ?? 0) === 0) {
    msg = `Bună ${nume}! 🌿\n\nMă bucur că ne-am cunoscut. Dacă vrei, îți pot pregăti o ofertă personalizată cu produsele care ți se potrivesc cel mai bine. Spune-mi ce te interesează!`
  } else if (contact.status === 'in_followup') {
    msg = `Bună ${nume}! 🌿\n\nVoiam doar să verific dacă ai apucat să te uiți peste oferta pe care ți-am trimis-o. Sunt aici pentru orice întrebare!`
  } else {
    msg = `Bună ${nume}! 🌿\n\nCe mai faci? Sunt aici dacă ai nevoie de ceva sau vrei să discutăm despre produse.`
  }

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
  setPrefillContactId: (id: string) => void,
  navigate: (path: string) => void
): void {
  setPrefillContactId(contact.id)
  try {
    sessionStorage.setItem('prefillContactId', contact.id)
    sessionStorage.setItem('prefillContactName', contact.name)
    if (contact.phone) sessionStorage.setItem('prefillContactPhone', contact.phone)
    if (contact.email) sessionStorage.setItem('prefillContactEmail', contact.email)
  } catch {
    // sessionStorage indisponibil — Zustand store-ul e suficient
  }
  navigate('/app/calculator')
}