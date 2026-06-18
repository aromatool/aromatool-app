import { useState, useEffect, type FormEvent } from "react";
import LeafMark from "../components/LeafMark";

// ============================================================
// COMING SOON — landing public pentru getaromatool.com până la lansare.
// Colectează emailuri (pre-înscriere) + consimțământ GDPR. La lansare,
// funcția `waitlist-launch` trimite codul de 15 zile gratis.
//
// Postează la `waitlist-signup` (deploy --no-verify-jwt) → FĂRĂ auth.
// Bilingv RO/EN (comutator sus). Mockup-ul de produs e recreat în CSS.
// ============================================================

const SAGE = "#5C7A5C";
const SAGE_SOFT = "#7B9479";
const PAGE = "#F5F4EF";
const ESPRESSO = "#2B2723";
const MUTED = "#6A5F57";
const BORDER = "#E7E3DA";
const FOOTER_BG = "#2E3A28";
const SERIF = "'Playfair Display', Georgia, serif";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Lang = "ro" | "en";

// ── Conținut RO/EN ───────────────────────────────────────────
const COPY: Record<Lang, {
  badge: string;
  headline: [string, string, string];
  intro: string;
  launchTitle: string;
  launchSub: string;
  cardTitle: string;
  cardSub: string;
  emailPlaceholder: string;
  button: string;
  sending: string;
  bullets: [string, string, string];
  consentBefore: string;
  consentLink: string;
  consentAfter: string;
  noSpam: string;
  successTitle: string;
  successBody: string;
  errEmail: string;
  errGeneric: string;
  features: { title: string; body: string }[];
  footerTag: string;
  footerFeatures: string[];
  rights: string;
  privacy: string;
  terms: string;
}> = {
  ro: {
    badge: "Creat pentru lideri Young Living",
    headline: ["Organizează-te.", "Fă follow-up constant.", "Nu pierde niciun prospect."],
    intro:
      "AromaTool este CRM-ul all-in-one pentru liderii din wellness. Gestionează contacte, follow-up-uri, oferte și mai mult — totul într-un singur loc simplu.",
    launchTitle: "Lansăm în curând",
    launchSub: "Fii printre primii care află când AromaTool e live.",
    cardTitle: "Acces timpuriu",
    cardSub: "Înscrie-te pe listă și primești o reducere exclusivă de lansare.",
    emailPlaceholder: "Adresa ta de email",
    button: "Anunță-mă când e live",
    sending: "Se trimite...",
    bullets: ["15 zile gratis", "Reducere de lansare", "Fără card bancar"],
    consentBefore: "Sunt de acord să fiu contactat prin email la lansare. Vezi ",
    consentLink: "Politica de confidențialitate",
    consentAfter: ".",
    noSpam: "Fără spam. Te anunțăm o singură dată, la lansare.",
    successTitle: "Te-am adăugat pe listă!",
    successBody:
      "La lansare îți trimitem un email cu codul tău de 15 zile gratis. Verifică-ți inbox-ul în curând.",
    errEmail: "Adresa de email pare invalidă.",
    errGeneric: "Ceva n-a mers. Mai încearcă o dată în câteva momente.",
    features: [
      { title: "Gestionează-ți contactele", body: "Ține toți prospecții și clienții organizați într-un singur loc." },
      { title: "Nu rata niciun follow-up", body: "Memento-uri și follow-up-uri care te ajută să construiești relații reale." },
      { title: "Creează și trimite oferte ușor", body: "Construiește oferte frumoase în câteva secunde și trimite-le direct clienților." },
      { title: "Crește-ți afacerea", body: "Urmărește-ți progresul și crește-ți echipa cu claritate și încredere." },
    ],
    footerTag: "Construit cu ❤️ pentru liderii care inspiră și fac diferența.",
    footerFeatures: ["Sigur și privat", "Acces de oriunde", "Creat pentru lideri wellness"],
    rights: "Toate drepturile rezervate.",
    privacy: "Politica de confidențialitate",
    terms: "Termeni și condiții",
  },
  en: {
    badge: "Built for Young Living leaders",
    headline: ["Stay organized.", "Follow up consistently.", "Never lose a prospect."],
    intro:
      "AromaTool is the all-in-one CRM for wellness leaders. Manage contacts, follow-ups, offers and more — all in one simple place.",
    launchTitle: "Launching soon",
    launchSub: "Be among the first to know when AromaTool is live.",
    cardTitle: "Get early access",
    cardSub: "Join the waitlist and receive an exclusive launch discount.",
    emailPlaceholder: "Your email address",
    button: "Notify me when it's live",
    sending: "Sending...",
    bullets: ["15-day free trial", "Launch discount", "No credit card required"],
    consentBefore: "I agree to be contacted by email at launch. See the ",
    consentLink: "Privacy Policy",
    consentAfter: ".",
    noSpam: "No spam. We'll email you once, at launch.",
    successTitle: "You're on the list!",
    successBody:
      "At launch we'll email you your 15-day free code. Keep an eye on your inbox.",
    errEmail: "That email looks invalid.",
    errGeneric: "Something went wrong. Please try again in a moment.",
    features: [
      { title: "Manage your contacts", body: "Keep all your prospects and customers organized in one place." },
      { title: "Never miss a follow-up", body: "Reminders and follow-ups that help you build real relationships." },
      { title: "Create & send offers easily", body: "Build beautiful offers in seconds and send them directly to your clients." },
      { title: "Grow your business", body: "Track your progress and grow your team with clarity and confidence." },
    ],
    footerTag: "Built with ❤️ for leaders who inspire and make an impact.",
    footerFeatures: ["Secure & private", "Access anywhere", "Made for wellness leaders"],
    rights: "All rights reserved.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  },
};

function useIsNarrow(maxWidth = 900): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width:${maxWidth}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${maxWidth}px)`);
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [maxWidth]);
  return narrow;
}

// ── Iconițe simple (inline SVG, fără dependențe) ─────────────
const iconStroke = { fill: "none", stroke: SAGE, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconUsers() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" {...iconStroke}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M22 20c0-2.5-1.5-4-4-4.5" /></svg>);
}
function IconCheckList() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" {...iconStroke}><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" /><path d="M11 6h9M11 12h9M11 18h9" /></svg>);
}
function IconDoc() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" {...iconStroke}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>);
}
function IconGrowth() {
  return (<svg width="22" height="22" viewBox="0 0 24 24" {...iconStroke}><path d="M4 16l5-5 3 3 7-7" /><path d="M16 7h4v4" /></svg>);
}
function IconShield() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D6C2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>);
}
function IconCloud() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D6C2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.5A3.5 3.5 0 0 1 17 18z" /></svg>);
}
function IconTeam() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8D6C2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="2.5" /><path d="M4 19c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" /><path d="M16 6a2.5 2.5 0 0 1 0 5M20 19c0-2.2-1.3-3.6-3.3-4.1" /></svg>);
}

// ── Vizual hero — imaginea de produs (laptop + telefon) ──────
// Fișierul stă în public/coming-soon-hero.png (PNG, ideal cu fundal
// transparent ca să se topească în pagina crem).
function HeroMockup() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640 }}>
      <img
        src="/coming-soon-hero.png"
        alt="AromaTool — dashboard pe laptop și telefon"
        style={{ display: "block", width: "100%", height: "auto" }}
      />
    </div>
  );
}

export default function ComingSoonPage() {
  const [lang, setLang] = useState<Lang>("ro");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const narrow = useIsNarrow(900);
  const t = COPY[lang];

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = emailValid && consent && status !== "sending";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/waitlist-signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), consent: true, source: "coming_soon" }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "save_failed");
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error && err.message === "invalid_email" ? t.errEmail : t.errGeneric);
    }
  }

  const featureIcons = [<IconUsers />, <IconCheckList />, <IconDoc />, <IconGrowth />];
  const footerIcons = [<IconShield />, <IconCloud />, <IconTeam />];

  return (
    <div style={{ background: PAGE, minHeight: "100vh", fontFamily: "'Helvetica Neue', Arial, sans-serif", color: ESPRESSO }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: narrow ? "0 18px" : "0 32px" }}>
        {/* ── Header ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: SAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LeafMark size={21} color="#fff" strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: ESPRESSO }}>AromaTool</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Comutator limbă */}
            <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              {(["ro", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  border: "none", padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: lang === l ? SAGE : "transparent", color: lang === l ? "#fff" : MUTED,
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
            {!narrow && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#EAF1E8", color: SAGE, fontSize: 13, fontWeight: 600, padding: "9px 15px", borderRadius: 999 }}>
                <LeafMark size={15} color={SAGE} strokeWidth={2.2} /> {t.badge}
              </span>
            )}
          </div>
        </header>

        {/* ── Hero ── */}
        <section style={{ display: "flex", gap: 40, alignItems: "center", flexDirection: narrow ? "column" : "row", padding: narrow ? "16px 0 8px" : "30px 0 50px" }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0, width: narrow ? "100%" : "auto" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: narrow ? 40 : 54, lineHeight: 1.08, margin: 0, fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ display: "block" }}>{t.headline[0]}</span>
              <span style={{ display: "block" }}>{t.headline[1]}</span>
              <span style={{ display: "block", color: SAGE }}>
                {t.headline[2]} <span style={{ fontFamily: "inherit" }}>🌿</span>
              </span>
            </h1>
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, maxWidth: 440, marginTop: 22 }}>{t.intro}</p>

            {/* Launching soon */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginTop: 34 }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, background: "#EAF1E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: ESPRESSO }}>{t.launchTitle}</div>
                <div style={{ fontSize: 14, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{t.launchSub}</div>
              </div>
            </div>

            {/* Card formular / succes */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: 26, marginTop: 22, maxWidth: 500, boxShadow: "0 10px 30px rgba(43,39,35,0.05)" }}>
              {status === "done" ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 38 }}>🌿</div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 8 }}>{t.successTitle}</div>
                  <div style={{ fontSize: 14, color: MUTED, marginTop: 9, lineHeight: 1.6 }}>{t.successBody}</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{t.cardTitle}</div>
                  <div style={{ fontSize: 14, color: MUTED, marginTop: 7, lineHeight: 1.55 }}>{t.cardSub}</div>
                  <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${BORDER}`, borderRadius: 11, padding: "0 14px", background: "#fff" }}>
                      <input
                        type="email" inputMode="email" autoComplete="email" placeholder={t.emailPlaceholder}
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                        style={{ flex: 1, border: "none", outline: "none", padding: "14px 0", fontSize: 15, color: ESPRESSO, background: "transparent" }}
                      />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7AC9F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                    </div>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 13, fontSize: 12.5, color: MUTED, lineHeight: 1.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: SAGE, flexShrink: 0 }} />
                      <span>{t.consentBefore}<a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: SAGE, textDecoration: "underline" }}>{t.consentLink}</a>{t.consentAfter}</span>
                    </label>

                    {status === "error" && <div style={{ fontSize: 12.5, color: "#B4584D", marginTop: 11 }}>{errorMsg}</div>}

                    <button type="submit" disabled={!canSubmit} style={{
                      width: "100%", marginTop: 15, padding: 15, fontSize: 15, fontWeight: 700, color: "#fff",
                      background: canSubmit ? SAGE : "#B7C2B5", border: "none", borderRadius: 11,
                      cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                      {status === "sending" ? t.sending : t.button}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Bullet-uri */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: 18, maxWidth: 500 }}>
              {t.bullets.map((b) => (
                <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: ESPRESSO }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SAGE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Right — mockup (ascuns pe ecrane foarte mici) */}
          {!narrow && (
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
              <HeroMockup />
            </div>
          )}
        </section>

        {/* ── Features ── */}
        <section style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, padding: narrow ? "26px 18px" : "38px 30px", margin: "10px 0 40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(4, 1fr)", gap: narrow ? 26 : 22 }}>
            {t.features.map((f, i) => (
              <div key={f.title} style={{ textAlign: "center", padding: narrow ? 0 : "0 6px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: "#EFF3ED", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {featureIcons[i]}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: ESPRESSO, lineHeight: 1.25 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10, lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer dark ── */}
      <footer style={{ background: FOOTER_BG, color: "#D8E0D2" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: narrow ? "32px 18px" : "44px 32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 360 }}>
            <LeafMark size={42} color="#7B9479" strokeWidth={1.6} />
            <div style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.4, color: "#EDF1E9" }}>{t.footerTag}</div>
          </div>
          <div style={{ display: "flex", gap: narrow ? 24 : 40, flexWrap: "wrap" }}>
            {t.footerFeatures.map((ff, i) => (
              <div key={ff} style={{ textAlign: "center", maxWidth: 110 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{footerIcons[i]}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#C8D6C2", lineHeight: 1.4 }}>{ff}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: narrow ? "16px 18px" : "18px 32px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "#9DAB95" }}>
            <span>© {new Date().getFullYear()} AromaTool. {t.rights}</span>
            <span style={{ display: "flex", gap: 22 }}>
              <a href="/legal/privacy" style={{ color: "#9DAB95", textDecoration: "none" }}>{t.privacy}</a>
              <a href="/legal/terms" style={{ color: "#9DAB95", textDecoration: "none" }}>{t.terms}</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
