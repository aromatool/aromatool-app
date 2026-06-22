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

// Interval IMPLICIT de follow-up (zile) dacă userul nu a setat altul în Settings.
// Folosit ca punct de plecare atât pentru primul follow-up după ofertă, cât și
// pentru ritmul follow-up-urilor ulterioare. Userul îl poate suprascrie din
// Settings (profiles.follow_up_days). Valoare conservatoare ca să nu sâcâim
// prospectul imediat după prima ofertă (poate nici n-a citit-o încă).
export const DEFAULT_FOLLOWUP_DAYS = 3

// Zile de la ultima activitate a unui client după care îi sugerăm o
// reaprovizionare (nudge lunar, aliniat cu comanda Loyalty Rewards). Sub
// INACTIVE_DAYS — un client „tăcut" devine reactivare/win-back abia după 60 zile.
export const REORDER_DAYS = 30
