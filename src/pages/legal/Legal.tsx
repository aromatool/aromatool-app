// ============================================================
// PAGINI LEGALE — Privacy Policy, Terms of Service, Cookie Policy.
// Pagini publice (nu necesită login). Conținut practic pentru un
// SaaS la început, în RO/UE.
//
// ⚠️ DRAFT — textul de mai jos e un punct de plecare solid, dar
// trebuie completat cu datele firmei (vezi COMPANY) și validat
// scurt de un jurist înainte de lansarea publică.
// ============================================================

import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

// ── COMPLETEAZĂ DATELE FIRMEI AICI ─────────────────────────
// Acestea apar în toate documentele legale.
export const COMPANY = {
  legalName: "[DENUMIRE FIRMĂ SRL]",
  cui: "[CUI / J__/____/____]",
  address: "[Adresă sediu social, România]",
  contactEmail: "[contact@aromatool.com]",
  privacyEmail: "[privacy@aromatool.com]",
  appName: "AromaTool",
  appUrl: "aromatool.com",
  lastUpdated: "11 iunie 2026",
};

const T = {
  sage: "#5C7A5C",
  cream: "#FAFAF7",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  amberLight: "#FDF5EE",
  amber: "#C4906A",
};

// ── LAYOUT COMUN ───────────────────────────────────────────
function LegalLayout({
  t,
  title,
  intro,
  children,
}: {
  t: TFunction;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.cream,
        fontFamily: "'DM Sans', sans-serif",
        color: T.espresso,
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link
          to="/auth"
          style={{
            fontSize: "13px",
            color: T.sage,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          {t("legal.back")}
        </Link>

        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "28px",
            color: T.espresso,
            marginTop: "20px",
            marginBottom: "4px",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "12px", color: T.muted, marginBottom: "8px" }}>
          {t("legal.lastUpdated", {
            appName: COMPANY.appName,
            lastUpdated: COMPANY.lastUpdated,
          })}
        </div>

        {/* Banner draft — de eliminat după validarea juridică */}
        <div
          style={{
            background: T.amberLight,
            border: `1px solid ${T.amber}33`,
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "12px",
            color: T.warm,
            marginBottom: "24px",
            lineHeight: 1.6,
          }}
        >
          {t("legal.draftBanner")}
        </div>

        {intro && (
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: T.warm }}>
            {intro}
          </p>
        )}

        <div style={{ marginTop: "12px" }}>{children}</div>

        <div
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: `1px solid ${T.border}`,
            fontSize: "13px",
            color: T.muted,
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <Link to="/legal/privacy" style={{ color: T.sage }}>
            {t("legal.navPrivacy")}
          </Link>
          <Link to="/legal/terms" style={{ color: T.sage }}>
            {t("legal.navTerms")}
          </Link>
          <Link to="/legal/cookies" style={{ color: T.sage }}>
            {t("legal.navCookies")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: "28px" }}>
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: T.espresso,
          marginBottom: "10px",
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: "14px", lineHeight: 1.75, color: T.warm }}>
        {children}
      </div>
    </section>
  );
}

const ul: React.CSSProperties = {
  margin: "8px 0",
  paddingLeft: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

// Randează o listă de bullet-uri dintr-o cheie i18n care întoarce un array
// (t(key, { returnObjects: true })). Folosit de secțiunile din Termeni.
function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={ul}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

// ════════════════════════════════════════════════════════════
// 1. PRIVACY POLICY
// ════════════════════════════════════════════════════════════
export function PrivacyPage() {
  const { t } = useTranslation();
  const appName = COMPANY.appName;
  // Helper pentru listele din Confidențialitate (chei care întorc array-uri).
  const items = (key: string) =>
    t(key, { returnObjects: true }) as unknown as string[];
  return (
    <LegalLayout
      t={t}
      title={t("legal.privacyTitle")}
      intro={t("legal.privacyIntro", { appName })}
    >
      {/* S1 — Operatorul de date */}
      <Section title={t("legal.privacyS1Title")}>
        {t("legal.privacyS1Body", {
          legalName: COMPANY.legalName,
          cui: COMPANY.cui,
          address: COMPANY.address,
          appName,
          appUrl: COMPANY.appUrl,
        })}
        <strong>{COMPANY.privacyEmail}</strong>.
      </Section>

      {/* S2 — Rolurile (operator / persoană împuternicită) */}
      <Section title={t("legal.privacyS2Title")}>
        {t("legal.privacyS2Intro", { appName })}
        <Bullets items={items("legal.privacyS2Items")} />
      </Section>

      {/* S3 — Ce date colectăm */}
      <Section title={t("legal.privacyS3Title")}>
        <Bullets items={items("legal.privacyS3Items")} />
      </Section>

      {/* S4 — Temeiul și scopurile prelucrării */}
      <Section title={t("legal.privacyS4Title")}>
        <Bullets items={items("legal.privacyS4Items")} />
      </Section>

      {/* S5 — Comunicări email și tracking */}
      <Section title={t("legal.privacyS5Title")}>
        {t("legal.privacyS5Body", { appName })}
      </Section>

      {/* S6 — Date sensibile (categorii speciale) */}
      <Section title={t("legal.privacyS6Title")}>
        {t("legal.privacyS6Body", { appName })}
      </Section>

      {/* S7 — Sub-procesatori */}
      <Section title={t("legal.privacyS7Title")}>
        {t("legal.privacyS7Intro")}
        <Bullets items={items("legal.privacyS7Items")} />
        {t("legal.privacyS7Closing")}
      </Section>

      {/* S8 — Transferuri internaționale */}
      <Section title={t("legal.privacyS8Title")}>
        {t("legal.privacyS8Body")}
      </Section>

      {/* S9 — Păstrarea datelor */}
      <Section title={t("legal.privacyS9Title")}>
        <Bullets items={items("legal.privacyS9Items")} />
      </Section>

      {/* S10 — Drepturile tale */}
      <Section title={t("legal.privacyS10Title")}>
        {t("legal.privacyS10Body1")}
        <strong>{COMPANY.privacyEmail}</strong>
        {t("legal.privacyS10Body2")}
        <strong>{t("legal.privacyS10Authority")}</strong>
        {t("legal.privacyS10Body3")}
      </Section>

      {/* S11 — Securitate */}
      <Section title={t("legal.privacyS11Title")}>
        {t("legal.privacyS11Body")}
      </Section>

      {/* S12 — Incidente de securitate */}
      <Section title={t("legal.privacyS12Title")}>
        {t("legal.privacyS12Body")}
      </Section>

      {/* S13 — Minori */}
      <Section title={t("legal.privacyS13Title")}>
        {t("legal.privacyS13Body")}
      </Section>

      {/* S14 — Modificări */}
      <Section title={t("legal.privacyS14Title")}>
        {t("legal.privacyS14Body")}
      </Section>
    </LegalLayout>
  );
}

// ════════════════════════════════════════════════════════════
// 2. TERMS OF SERVICE
// ════════════════════════════════════════════════════════════
export function TermsPage() {
  const { t } = useTranslation();
  const appName = COMPANY.appName;
  // Helper pentru listele din Termeni (chei care întorc array-uri).
  const items = (key: string) =>
    t(key, { returnObjects: true }) as unknown as string[];
  return (
    <LegalLayout
      t={t}
      title={t("legal.termsTitle")}
      intro={t("legal.termsIntro", { appName })}
    >
      <Section title={t("legal.termsS1Title")}>
        {t("legal.termsS1Body", { appName })}
      </Section>

      <Section title={t("legal.termsS2Title")}>
        {t("legal.termsS2Body", { appName })}
      </Section>

      <Section title={t("legal.termsS3Title")}>
        {t("legal.termsS3Body")}
      </Section>

      <Section title={t("legal.termsS4Title")}>
        {t("legal.termsS4Intro", { appName })}
        <Bullets items={items("legal.termsS4Items")} />
        {t("legal.termsS4Closing")}
      </Section>

      <Section title={t("legal.termsS5Title")}>
        {t("legal.termsS5Intro")}
        <Bullets items={items("legal.termsS5Items")} />
      </Section>

      <Section title={t("legal.termsS6Title")}>
        {t("legal.termsS6Body", { appName })}
      </Section>

      <Section title={t("legal.termsS7Title")}>
        {t("legal.termsS7Body", { appName })}
      </Section>

      <Section title={t("legal.termsS8Title")}>
        {t("legal.termsS8Intro", { appName })}
        <Bullets items={items("legal.termsS8Items")} />
      </Section>

      <Section title={t("legal.termsS9Title")}>
        {t("legal.termsS9Body", { appName })}
      </Section>

      <Section title={t("legal.termsS10Title")}>
        {t("legal.termsS10Intro")}
        <Bullets items={items("legal.termsS10Items")} />
      </Section>

      <Section title={t("legal.termsS11Title")}>
        {t("legal.termsS11Body", { appName })}
      </Section>

      <Section title={t("legal.termsS12Title")}>
        {t("legal.termsS12Body", { appName })}
      </Section>

      <Section title={t("legal.termsS13Title")}>
        {t("legal.termsS13Body", { appName })}
      </Section>

      <Section title={t("legal.termsS14Title")}>
        {t("legal.termsS14Body", { appName })}
      </Section>

      <Section title={t("legal.termsS15Title")}>
        {t("legal.termsS15Body", { appName })}
      </Section>

      <Section title={t("legal.termsS16Title")}>
        {t("legal.termsS16Body")}
      </Section>

      <Section title={t("legal.termsS17Title")}>
        {t("legal.termsS17Body")}
      </Section>

      <Section title={t("legal.termsS18Title")}>
        {t("legal.termsS18Body", { appName })}
      </Section>

      <Section title={t("legal.termsS19Title")}>
        {t("legal.termsS19Body")}
      </Section>

      <Section title={t("legal.termsS20Title")}>
        {t("legal.termsS20Body")}
        <strong>{COMPANY.contactEmail}</strong>.
      </Section>
    </LegalLayout>
  );
}

// ════════════════════════════════════════════════════════════
// 3. COOKIE POLICY
// ════════════════════════════════════════════════════════════
export function CookiePage() {
  const { t } = useTranslation();
  return (
    <LegalLayout
      t={t}
      title={t("legal.cookieTitle")}
      intro={t("legal.cookieIntro", { appName: COMPANY.appName })}
    >
      <Section title={t("legal.cookieS1Title")}>
        <ul style={ul}>
          <li>
            <strong>{t("legal.cookieS1Li1Bold")}</strong>
            {t("legal.cookieS1Li1Body")}
          </li>
          <li>
            <strong>{t("legal.cookieS1Li2Bold")}</strong>
            {t("legal.cookieS1Li2Body")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.cookieS2Title")}>
        {t("legal.cookieS2Body")}
      </Section>

      <Section title={t("legal.cookieS3Title")}>
        {t("legal.cookieS3Body")}
      </Section>

      <Section title={t("legal.cookieS4Title")}>
        {t("legal.cookieS4Body")}
      </Section>
    </LegalLayout>
  );
}
