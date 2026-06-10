// ============================================================
// CRM THRESHOLDS — sursă unică de adevăr pentru pragurile de timp/business
// ============================================================
// Aceste valori erau dublate în mai multe fișiere (DashboardPage.enrichContact,
// recommendedAction.computeAction, contactActions.buildWhatsAppGreeting) și
// începuseră să dreapă (un loc folosea `>= 60`, altul `> 60`). Le centralizăm
// aici ca să existe O SINGURĂ definiție. Modul pur, fără React/DOM — poate fi
// importat și de Edge Functions (Deno) prin focusToday.
// ============================================================

// Zile fără activitate după care un contact e considerat „inactiv" / candidat
// de reactivare (atât pentru clienți, cât și pentru evidențierea în Dashboard
// și pentru tonul mesajului WhatsApp).
export const INACTIVE_DAYS = 60

// Zile de la ultimul follow-up după care acesta e considerat „învechit"
// (trebuie reluat). Era deja centralizat în recommendedAction; îl mutăm aici.
export const FOLLOWUP_STALE_DAYS = 7
