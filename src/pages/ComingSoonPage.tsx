import { useState, useEffect, type FormEvent } from "react";
import LeafMark from "../components/LeafMark";

// ============================================================
// COMING SOON — landing public pentru getaromatool.com până la lansare.
// Colectează emailuri (pre-înscriere) + consimțământ GDPR. La lansare,
// funcția `waitlist-launch` trimite codul de 15 zile gratis.
//
// Postează la `waitlist-signup` (deploy --no-verify-jwt) → FĂRĂ auth.
// Bilingv RO/EN (comutator sus). Imaginea de produs (hero) e PNG cu
// fundal transparent în public/coming-soon-hero.png.
// ============================================================

const SAGE = "#5C7A5C";
const SAGE_DEEP = "#4A6A4A";
const SOFT = "#EAF1E8";
const PAGE = "#F6F5F0";
const ESPRESSO = "#2B2723";
const MUTED = "#6E6358";
const BORDER = "#E7E3DA";
const FOOTER_BG = "#2E3A28";
const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'DM Sans', 'Helvetica Neue', Arial, sans-serif";

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
    cardTitle: "Înscrie-te la lansare",
    cardSub: "La lansare îți trimitem un email cu codul tău de 15 zile gratis. Verifică-ți inbox-ul în curând.",
    emailPlaceholder: "Adresa ta de email",
    button: "Vreau să fiu anunțat",
    sending: "Se trimite...",
    bullets: ["15 zile gratis", "Reducere de lansare", "Fără card bancar"],
    consentBefore: "Sunt de acord să fiu contactat prin email la lansare. Vezi ",
    consentLink: "Politica de confidențialitate",
    consentAfter: ".",
    successTitle: "Te-am adăugat pe listă!",
    successBody:
      "La lansare îți trimitem un email cu codul tău de 15 zile gratis. Verifică-ți inbox-ul în curând.",
    errEmail: "Adresa de email pare invalidă.",
    errGeneric: "Ceva n-a mers. Mai încearcă o dată în câteva momente.",
    features: [
      { title: "Gestionează contactele", body: "Păstrează toate contactele și clienții organizați într-un singur loc." },
      { title: "Nu mai rata niciun follow-up", body: "Rămâi la zi cu memento-uri și follow-up-uri care construiesc relații reale." },
      { title: "Creează și trimite oferte ușor", body: "Construiește oferte frumoase în câteva secunde și trimite-le direct clienților tăi." },
      { title: "Dezvoltă-ți afacerea", body: "Urmărește-ți progresul și crește echipa cu claritate și încredere." },
    ],
    footerTag: "Creat cu ❤️ pentru liderii care inspiră și fac o diferență.",
    footerFeatures: ["Sigur și privat", "Acces de oriunde", "Dedicat liderilor din wellness"],
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
    cardTitle: "Join the launch list",
    cardSub: "At launch we'll email you your 15-day free code. Keep an eye on your inbox.",
    emailPlaceholder: "Your email address",
    button: "Notify me",
    sending: "Sending...",
    bullets: ["15-day free trial", "Launch discount", "No credit card required"],
    consentBefore: "I agree to be contacted by email at launch. See the ",
    consentLink: "Privacy Policy",
    consentAfter: ".",
    successTitle: "You're on the list!",
    successBody:
      "At launch we'll email you your 15-day free code. Keep an eye on your inbox.",
    errEmail: "That email looks invalid.",
    errGeneric: "Something went wrong. Please try again in a moment.",
    features: [
      { title: "Manage your contacts", body: "Keep all your contacts and customers organized in one place." },
      { title: "Never miss a follow-up", body: "Stay on top with reminders and follow-ups that build real relationships." },
      { title: "Create & send offers easily", body: "Build beautiful offers in seconds and send them directly to your clients." },
      { title: "Grow your business", body: "Track your progress and grow your team with clarity and confidence." },
    ],
    footerTag: "Built with ❤️ for leaders who inspire and make a difference.",
    footerFeatures: ["Secure & private", "Access anywhere", "Dedicated to wellness leaders"],
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
function IconRocket({ color = SAGE, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5c2.8 1.7 4.5 5 4.5 8.8 0 1.9-.5 3.4-1 4.4h-7c-.5-1-1-2.5-1-4.4 0-3.8 1.7-7.1 4.5-8.8z" />
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M8.5 15.7 6 18.2M15.5 15.7 18 18.2" />
      <path d="M10 18.5c0 1.4 2 2.8 2 2.8s2-1.4 2-2.8" />
    </svg>
  );
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

// ── Frunze decorative de fundal (discrete, sub conținut) ─────
function LeafBranch({ size = 240, color = SAGE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M40 180C70 120 110 80 170 60" />
        <path d="M170 60c-6-22-24-30-48-24-18 5-26 22-22 40 18 4 60 4 70-16z" fill={color} fillOpacity="0.5" />
        <path d="M118 96c-10-16-28-18-46-10-12 6-14 22-6 36 16 0 46-8 52-26z" fill={color} fillOpacity="0.5" />
        <path d="M78 130c-12-12-28-10-42 0-8 6-6 20 4 30 14-2 36-14 38-30z" fill={color} fillOpacity="0.5" />
      </g>
    </svg>
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
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        fontFamily: SANS,
        color: ESPRESSO,
        background:
          "radial-gradient(1100px 560px at 82% -8%, #EDF3EA 0%, rgba(237,243,234,0) 60%)," +
          "radial-gradient(900px 500px at -5% 8%, #EEF2EA 0%, rgba(238,242,234,0) 55%)," +
          PAGE,
      }}
    >
      {/* Frunze decorative — pur ornamentale, sub conținut */}
      <div aria-hidden style={{ position: "absolute", top: -40, right: -50, opacity: 0.07, pointerEvents: "none", transform: "rotate(8deg)" }}>
        <LeafBranch size={narrow ? 220 : 360} />
      </div>
      <div aria-hidden style={{ position: "absolute", bottom: 120, left: -60, opacity: 0.06, pointerEvents: "none", transform: "rotate(-160deg)" }}>
        <LeafBranch size={narrow ? 180 : 300} />
      </div>

      <div style={{ position: "relative", maxWidth: 1140, margin: "0 auto", padding: narrow ? "0 18px" : "0 36px" }}>
        {/* ── Header ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(150deg, ${SAGE} 0%, ${SAGE_DEEP} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(74,106,74,0.28)" }}>
              <LeafMark size={23} color="#fff" strokeWidth={2.2} />
            </div>
            <span style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 700, color: ESPRESSO, letterSpacing: "-0.01em" }}>AromaTool</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Comutator limbă */}
            <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(43,39,35,0.04)" }}>
              {(["ro", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} style={{
                  border: "none", padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: SANS,
                  background: lang === l ? SAGE : "transparent", color: lang === l ? "#fff" : MUTED, transition: "background .15s",
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
            {!narrow && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: SAGE_DEEP, fontSize: 13, fontWeight: 600, padding: "9px 16px", borderRadius: 999, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(43,39,35,0.04)" }}>
                <LeafMark size={15} color={SAGE} strokeWidth={2.2} /> {t.badge}
              </span>
            )}
          </div>
        </header>

        {/* ── Hero ── */}
        <section style={{ display: "flex", gap: narrow ? 30 : 48, alignItems: "center", flexDirection: narrow ? "column" : "row", padding: narrow ? "12px 0 8px" : "26px 0 56px" }}>
          {/* Left */}
          <div style={{ flex: "1 1 0", minWidth: 0, width: narrow ? "100%" : "auto" }}>
            <h1 style={{ fontFamily: SERIF, fontSize: narrow ? 40 : 56, lineHeight: 1.07, margin: 0, fontWeight: 700, letterSpacing: "-0.015em" }}>
              <span style={{ display: "block" }}>{t.headline[0]}</span>
              <span style={{ display: "block" }}>{t.headline[1]}</span>
              <span style={{ display: "block", color: SAGE }}>
                {t.headline[2]} <span style={{ fontFamily: "inherit" }}>🌿</span>
              </span>
            </h1>
            <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.62, maxWidth: 460, marginTop: 22 }}>{t.intro}</p>

            {/* Launching soon */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginTop: 32 }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconRocket />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: ESPRESSO }}>{t.launchTitle}</div>
                <div style={{ fontSize: 14, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{t.launchSub}</div>
              </div>
            </div>

            {/* Card formular / succes */}
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 20, padding: narrow ? 22 : 28, marginTop: 22, maxWidth: 520, boxShadow: "0 18px 44px rgba(43,39,35,0.07)" }}>
              {status === "done" ? (
                <div style={{ textAlign: "center", padding: "6px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                    <LeafMark size={28} color={SAGE} strokeWidth={2} />
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, marginTop: 12 }}>{t.successTitle}</div>
                  <div style={{ fontSize: 14.5, color: MUTED, marginTop: 9, lineHeight: 1.6 }}>{t.successBody}</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <LeafMark size={20} color={SAGE} strokeWidth={2.1} />
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: ESPRESSO }}>{t.cardTitle}</div>
                  </div>
                  <div style={{ fontSize: 14, color: MUTED, marginTop: 11, lineHeight: 1.58 }}>{t.cardSub}</div>
                  <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0 14px", background: "#FCFBF8" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B7AC9F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                      <input
                        type="email" inputMode="email" autoComplete="email" placeholder={t.emailPlaceholder}
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                        style={{ flex: 1, border: "none", outline: "none", padding: "15px 0", fontSize: 15, color: ESPRESSO, background: "transparent", fontFamily: SANS }}
                      />
                    </div>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 14, fontSize: 12.5, color: MUTED, lineHeight: 1.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: SAGE, flexShrink: 0 }} />
                      <span>{t.consentBefore}<a href="/legal/privacy" target="_blank" rel="noreferrer" style={{ color: SAGE, textDecoration: "underline" }}>{t.consentLink}</a>{t.consentAfter}</span>
                    </label>

                    {status === "error" && <div style={{ fontSize: 12.5, color: "#B4584D", marginTop: 11 }}>{errorMsg}</div>}

                    <button type="submit" disabled={!canSubmit} style={{
                      width: "100%", marginTop: 16, padding: 15, fontSize: 15.5, fontWeight: 700, color: "#fff", fontFamily: SANS,
                      background: canSubmit ? `linear-gradient(150deg, ${SAGE} 0%, ${SAGE_DEEP} 100%)` : "#B7C2B5", border: "none", borderRadius: 12,
                      cursor: canSubmit ? "pointer" : "not-allowed", boxShadow: canSubmit ? "0 8px 20px rgba(74,106,74,0.25)" : "none", transition: "box-shadow .15s",
                    }}>
                      {status === "sending" ? t.sending : t.button}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Bullet-uri */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px", marginTop: 20, maxWidth: 520 }}>
              {t.bullets.map((b) => (
                <span key={b} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: ESPRESSO }}>
                  <span style={{ width: 19, height: 19, borderRadius: 999, background: SOFT, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={SAGE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6" /></svg>
                  </span>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Right — hero (ascuns pe ecrane foarte mici) */}
          {!narrow && (
            <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", justifyContent: "center", position: "relative" }}>
              {/* glow difuz în spatele imaginii transparente */}
              <div aria-hidden style={{ position: "absolute", inset: "8% 4%", background: "radial-gradient(closest-side, rgba(92,122,92,0.14), rgba(92,122,92,0))", filter: "blur(8px)" }} />
              <img
                src="/coming-soon-hero.png"
                alt="AromaTool — dashboard pe laptop și telefon"
                style={{ position: "relative", display: "block", width: "100%", maxWidth: 660, height: "auto", filter: "drop-shadow(0 26px 50px rgba(43,39,35,0.16))" }}
              />
            </div>
          )}
        </section>

        {/* ── Features ── */}
        <section style={{ background: "rgba(255,255,255,0.66)", backdropFilter: "blur(2px)", border: `1px solid ${BORDER}`, borderRadius: 24, padding: narrow ? "26px 18px" : "42px 34px", margin: "6px 0 44px", boxShadow: "0 12px 36px rgba(43,39,35,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(4, 1fr)", gap: narrow ? 28 : 26 }}>
            {t.features.map((f, i) => (
              <div key={f.title} style={{ textAlign: "center", padding: narrow ? 0 : "0 6px" }}>
                <div style={{ width: 54, height: 54, borderRadius: 999, background: SOFT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  {featureIcons[i]}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 19.5, fontWeight: 700, color: ESPRESSO, lineHeight: 1.25 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: MUTED, marginTop: 10, lineHeight: 1.62 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Footer dark ── */}
      <footer style={{ position: "relative", background: FOOTER_BG, color: "#D8E0D2" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: narrow ? "32px 18px" : "48px 36px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 380 }}>
            <LeafMark size={42} color="#7B9479" strokeWidth={1.6} />
            <div style={{ fontFamily: SERIF, fontSize: 18.5, lineHeight: 1.4, color: "#EDF1E9" }}>{t.footerTag}</div>
          </div>
          <div style={{ display: "flex", gap: narrow ? 26 : 44, flexWrap: "wrap" }}>
            {t.footerFeatures.map((ff, i) => (
              <div key={ff} style={{ textAlign: "center", maxWidth: 120 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 9 }}>{footerIcons[i]}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#C8D6C2", lineHeight: 1.4 }}>{ff}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: narrow ? "16px 18px" : "18px 36px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "#9DAB95" }}>
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
