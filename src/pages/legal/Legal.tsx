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
  lastUpdated: "8 iunie 2026",
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

// ════════════════════════════════════════════════════════════
// 1. PRIVACY POLICY
// ════════════════════════════════════════════════════════════
export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout
      t={t}
      title={t("legal.privacyTitle")}
      intro={t("legal.privacyIntro", { appName: COMPANY.appName })}
    >
      <Section title={t("legal.privacyS1Title")}>
        {t("legal.privacyS1Body", {
          legalName: COMPANY.legalName,
          cui: COMPANY.cui,
          address: COMPANY.address,
          appName: COMPANY.appName,
          appUrl: COMPANY.appUrl,
        })}
        <strong>{COMPANY.privacyEmail}</strong>.
      </Section>

      <Section title={t("legal.privacyS2Title")}>
        <ul style={ul}>
          <li>
            {t("legal.privacyS2Li1Pre")}
            <strong>{t("legal.privacyS2Li1Bold1")}</strong>
            {t("legal.privacyS2Li1Mid")}
            <strong>{t("legal.privacyS2Li1Bold2")}</strong>
            {t("legal.privacyS2Li1Post")}
          </li>
          <li>
            {t("legal.privacyS2Li2Pre")}
            <strong>{t("legal.privacyS2Li2Bold1")}</strong>
            {t("legal.privacyS2Li2Mid")}
            <strong>{t("legal.privacyS2Li2Bold2")}</strong>
            {t("legal.privacyS2Li2Mid2")}
            <strong>{t("legal.privacyS2Li2Bold3")}</strong>
            {t("legal.privacyS2Li2Post")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.privacyS3Title")}>
        <ul style={ul}>
          <li>
            <strong>{t("legal.privacyS3Li1Bold")}</strong>
            {t("legal.privacyS3Li1Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS3Li2Bold")}</strong>
            {t("legal.privacyS3Li2Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS3Li3Bold")}</strong>
            {t("legal.privacyS3Li3Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS3Li4Bold")}</strong>
            {t("legal.privacyS3Li4Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS3Li5Bold")}</strong>
            {t("legal.privacyS3Li5Body")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.privacyS4Title")}>
        <ul style={ul}>
          <li>
            <strong>{t("legal.privacyS4Li1Bold")}</strong>
            {t("legal.privacyS4Li1Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS4Li2Bold")}</strong>
            {t("legal.privacyS4Li2Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS4Li3Bold")}</strong>
            {t("legal.privacyS4Li3Body")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.privacyS5Title")}>
        {t("legal.privacyS5Intro")}
        <ul style={ul}>
          <li>
            <strong>{t("legal.privacyS5Li1Bold")}</strong>
            {t("legal.privacyS5Li1Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS5Li2Bold")}</strong>
            {t("legal.privacyS5Li2Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS5Li3Bold")}</strong>
            {t("legal.privacyS5Li3Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS5Li4Bold")}</strong>
            {t("legal.privacyS5Li4Body")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.privacyS6Title")}>
        <ul style={ul}>
          <li>
            <strong>{t("legal.privacyS6Li1Bold")}</strong>
            {t("legal.privacyS6Li1Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS6Li2Bold")}</strong>
            {t("legal.privacyS6Li2Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS6Li3Bold")}</strong>
            {t("legal.privacyS6Li3Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS6Li4Bold")}</strong>
            {t("legal.privacyS6Li4Body")}
          </li>
          <li>
            <strong>{t("legal.privacyS6Li5Bold")}</strong>
            {t("legal.privacyS6Li5Body")}
          </li>
        </ul>
      </Section>

      <Section title={t("legal.privacyS7Title")}>
        {t("legal.privacyS7Body1")}
        <strong>{COMPANY.privacyEmail}</strong>
        {t("legal.privacyS7Body2")}
        <strong>{t("legal.privacyS7Authority")}</strong>
        {t("legal.privacyS7Body3")}
      </Section>

      <Section title={t("legal.privacyS8Title")}>
        {t("legal.privacyS8Body")}
      </Section>

      <Section title={t("legal.privacyS9Title")}>
        {t("legal.privacyS9Body")}
      </Section>

      <Section title={t("legal.privacyS10Title")}>
        {t("legal.privacyS10Body")}
      </Section>
    </LegalLayout>
  );
}

// ════════════════════════════════════════════════════════════
// 2. TERMS OF SERVICE
// ════════════════════════════════════════════════════════════
export function TermsPage() {
  const { t } = useTranslation();
  return (
    <LegalLayout
      t={t}
      title={t("legal.termsTitle")}
      intro={t("legal.termsIntro", { appName: COMPANY.appName })}
    >
      <Section title={t("legal.termsS1Title")}>
        {t("legal.termsS1Body", { appName: COMPANY.appName })}
      </Section>

      <Section title={t("legal.termsS2Title")}>
        {t("legal.termsS2Body")}
      </Section>

      <Section title={t("legal.termsS3Title")}>
        {t("legal.termsS3Body")}
      </Section>

      <Section title={t("legal.termsS4Title")}>
        {t("legal.termsS4Pre")}
        <strong>{t("legal.termsS4Bold")}</strong>
        {t("legal.termsS4Post")}
        <ul style={ul}>
          <li>{t("legal.termsS4Li1")}</li>
          <li>{t("legal.termsS4Li2")}</li>
          <li>
            {t("legal.termsS4Li3Pre")}
            <strong>{t("legal.termsS4Li3Bold")}</strong>
            {t("legal.termsS4Li3Post")}
          </li>
        </ul>
        {t("legal.termsS4Closing")}
      </Section>

      <Section title={t("legal.termsS5Title")}>
        {t("legal.termsS5Intro")}
        <ul style={ul}>
          <li>{t("legal.termsS5Li1")}</li>
          <li>{t("legal.termsS5Li2")}</li>
          <li>{t("legal.termsS5Li3")}</li>
          <li>{t("legal.termsS5Li4")}</li>
          <li>{t("legal.termsS5Li5")}</li>
        </ul>
      </Section>

      <Section title={t("legal.termsS6Title")}>
        {t("legal.termsS6Intro", { appName: COMPANY.appName })}
        <ul style={ul}>
          <li>{t("legal.termsS6Li1")}</li>
          <li>{t("legal.termsS6Li2")}</li>
          <li>{t("legal.termsS6Li3")}</li>
          <li>{t("legal.termsS6Li4")}</li>
        </ul>
      </Section>

      <Section title={t("legal.termsS7Title")}>
        {t("legal.termsS7Body", { appName: COMPANY.appName })}
      </Section>

      <Section title={t("legal.termsS8Title")}>
        {t("legal.termsS8Body")}
      </Section>

      <Section title={t("legal.termsS9Title")}>
        {t("legal.termsS9Body")}
      </Section>

      <Section title={t("legal.termsS10Title")}>
        {t("legal.termsS10Body")}
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
