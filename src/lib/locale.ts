// ============================================================
// LOCALE BCP47 — sursă unică pentru formatarea datelor/numerelor
// în UI după limba aleasă (RO/EN). Trebuie să coincidă cu cheia
// `actions.localeCode` din fișierele de traducere.
// Folosit ca: new Date(iso).toLocaleDateString(uiLocale(i18n.language), …)
// ============================================================
export function uiLocale(lang?: string): string {
  return lang === "en" ? "en-GB" : "ro-RO";
}
