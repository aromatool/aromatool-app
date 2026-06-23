// U+0300–U+036F = semnele combinate de accent rămase după normalize("NFD").
const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Normalizează un text pentru căutare: litere mici, fără diacritice și fără
 * caractere speciale (®, ™, punctuație etc. → spațiu). Astfel „Thieves®
 * Household" devine „thieves household" și e găsit indiferent cum scrie
 * utilizatorul (cu/fără simboluri, cu/fără diacritice, unul sau mai multe cuvinte).
 */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Întoarce `true` dacă fiecare cuvânt din `query` apare (după normalizare) în
 * vreunul dintre câmpurile date. Folosit pentru căutarea pe nume + SKU.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const hay = fields.map((f) => normalizeText(f || "")).join(" ");
  // Variantă „lipită" (fără spații): „R.C" → normalizat „r c" → compact „rc".
  // Astfel căutarea „rc" găsește „Young Living R.C".
  const hayCompact = hay.replace(/ /g, "");
  return q
    .split(" ")
    .filter(Boolean)
    .every((tok) => hay.includes(tok) || hayCompact.includes(tok));
}
