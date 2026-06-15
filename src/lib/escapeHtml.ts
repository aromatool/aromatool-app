// ============================================================
// escapeHtml — neutralizează input-ul user înainte de a-l
// interpola în HTML-ul emailurilor (ofertă, follow-up, custom).
//
// De ce: i18n rulează cu `escapeValue: false` (ca să putem pune
// <strong> în traduceri) și TOT HTML-ul de email e construit prin
// interpolare de string. Fără escape, un nume de client / notă /
// produs custom de forma `<img src=x onerror=...>` sau `</td>...`
// ar fi injectat raw — strică layout-ul emailului real trimis
// clientului și se execută în preview-ul iframe (srcDoc).
//
// Convertim cele 5 caractere periculoase în entități. Pentru text
// pe mai multe rânduri, containerele folosesc deja `white-space:
// pre-wrap`, deci NU transformăm \n aici (apelantul decide).
// ============================================================

export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
