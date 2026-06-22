import type { TFunction } from "i18next";
import type { Contact } from "./contactTypes.ts";
import { getRecommendedAction, getActionType, ACTIONABLE_TYPES, getFollowUpDays } from "./recommendedAction.ts";
import type { ActionType, RecommendedAction } from "./recommendedAction.ts";

// ============================================================
// FOCUS TODAY — SURSA UNICĂ DE ADEVĂR
// Atât Dashboard-ul (la randare) cât și Daily Focus Email (cron,
// pe server) folosesc aceleași funcții. Modul pur, fără React/DOM,
// deci poate fi importat și de Edge Functions (Deno).
// ============================================================

// Rânduri brute așa cum vin din DB (subset minim necesar).
export interface RawOffer {
  id: string;
  contact_id: string;
  total_eur: number | null;
  sent_at: string;
}

export interface RawFollowup {
  id: string;
  contact_id: string;
  sent_at: string;
  status?: string;
}

/**
 * Adaugă agregatele derivate pe fiecare contact: numărul de oferte,
 * valoarea totală, ultima activitate, ultimul follow-up, prima ofertă.
 * Aceste câmpuri NU există în tabela `contacts` — se calculează din
 * `offers` + `followup_log`. Identic cu ce făcea Dashboard-ul inline.
 */
export function aggregateContacts(
  contacts: Contact[],
  offers: RawOffer[],
  followupLog: RawFollowup[]
): Contact[] {
  return contacts.map((c) => {
    const contactOffers = offers.filter((o) => o.contact_id === c.id);
    const offersCount = contactOffers.length;
    const totalEur = contactOffers.reduce((s, o) => s + (o.total_eur ?? 0), 0);

    const contactFu = followupLog.filter((f) => f.contact_id === c.id);
    const lastFollowupAt =
      contactFu.length > 0
        ? contactFu.reduce(
            (latest, f) =>
              new Date(f.sent_at) > new Date(latest) ? f.sent_at : latest,
            contactFu[0].sent_at
          )
        : null;

    const activityDates = [
      ...contactOffers.map((o) => o.sent_at),
      ...contactFu.map((f) => f.sent_at),
      c.updated_at,
    ].filter(Boolean) as string[];
    const lastActivityAt =
      activityDates.length > 0
        ? activityDates.reduce((latest, d) =>
            new Date(d) > new Date(latest) ? d : latest
          )
        : null;

    const firstOfferAt =
      contactOffers.length > 0
        ? contactOffers.reduce(
            (earliest, o) =>
              new Date(o.sent_at) < new Date(earliest) ? o.sent_at : earliest,
            contactOffers[0].sent_at
          )
        : (c.first_offer_at ?? null);

    return {
      ...c,
      offers_count: offersCount,
      total_eur: totalEur,
      last_activity_at: lastActivityAt,
      last_followup_at: lastFollowupAt,
      first_offer_at: firstOfferAt,
    };
  });
}

// Ordinea de prioritate pentru sortarea Focus Today.
// NOTĂ: trebuie să conțină TOATE tipurile din ACTIONABLE_TYPES, altfel un tip
// neacoperit ar primi indexOf === -1 și ar fi sortat GREȘIT în față, putând
// împinge un contact cu adevărat urgent peste `limit` (= contact „pierdut").
// Sortarea de mai jos e oricum robustă (necunoscut → la coadă), dar păstrăm
// lista completă ca rețea de siguranță explicită.
export const FOCUS_ACTION_PRIORITY: ActionType[] = [
  "reactivate",
  "needs_offer",
  "first_order",
  "needs_followup",
  "reorder",
  "discuss_business",
];

// Rang de prioritate robust: tipurile necunoscute (neincluse în listă) merg la
// COADĂ (Infinity), nu în față. Previne „pierderea" de contacte la slice(limit).
function focusRank(type: ActionType): number {
  const i = FOCUS_ACTION_PRIORITY.indexOf(type);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

export interface FocusItem {
  contact: Contact;
  action: RecommendedAction;
}

/**
 * Selecția Focus Today dintr-o listă de contacte deja agregate:
 *  - exclude contactele cu comunicarea blocată;
 *  - păstrează doar acțiunile actionabile acum;
 *  - sortează după prioritate;
 *  - limitează la `limit` (default 5).
 */
export function selectFocusToday(
  contacts: Contact[],
  t: TFunction,
  limit = 5,
  followUpDays: number = getFollowUpDays()
): FocusItem[] {
  return contacts
    .filter((c) => !c.communication_blocked)
    .filter((c) => ACTIONABLE_TYPES.includes(getActionType(c, followUpDays)))
    .sort((a, b) => focusRank(getActionType(a, followUpDays)) - focusRank(getActionType(b, followUpDays)))
    .slice(0, limit)
    .map((c) => ({ contact: c, action: getRecommendedAction(c, t, followUpDays) }));
}

/**
 * End-to-end: din rânduri brute (contacts + offers + followup_log)
 * direct la Focus Today. Folosit de Daily Focus Email pe server.
 */
export function getFocusToday(
  contacts: Contact[],
  offers: RawOffer[],
  followupLog: RawFollowup[],
  t: TFunction,
  limit = 5,
  followUpDays: number = getFollowUpDays()
): FocusItem[] {
  return selectFocusToday(aggregateContacts(contacts, offers, followupLog), t, limit, followUpDays);
}
