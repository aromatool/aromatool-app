import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// ============================================================
// LOCKED OVERLAY — învelește o secțiune „premium". Pentru userii
// fără acces, blurează conținutul (necitibil + neinteractiv) și
// suprapune un card cu CTA care deschide paywall-ul. Pentru cei cu
// acces, randează copiii neschimbat (transparent). Refolosibil pe
// orice secțiune (Dashboard: Focus Today + Agenda etc.).
// ============================================================

const C = {
  sage: "#5C7A5C",
  white: "#FFFFFF",
  espresso: "#3D3530",
  warm: "#6A5A50",
  border: "#EDE8E0",
};

export default function LockedOverlay({
  locked,
  onUnlock,
  children,
  title,
  body,
}: {
  locked: boolean;
  onUnlock: () => void;
  children: ReactNode;
  title?: string;
  body?: string;
}) {
  const { t } = useTranslation();
  if (!locked) return <>{children}</>;

  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          filter: "blur(6px)",
          pointerEvents: "none",
          userSelect: "none",
          opacity: 0.55,
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 2,
        }}
      >
        <div
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "22px 24px",
            maxWidth: 320,
            textAlign: "center",
            boxShadow: "0 8px 28px rgba(61,53,48,0.14)",
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 17,
              color: C.espresso,
              marginBottom: 6,
            }}
          >
            {title ?? t("paywall.locked.title")}
          </div>
          <p
            style={{
              fontSize: 13,
              color: C.warm,
              lineHeight: 1.5,
              margin: "0 0 14px",
            }}
          >
            {body ?? t("paywall.locked.body")}
          </p>
          <button
            onClick={onUnlock}
            style={{
              padding: "10px 20px",
              background: C.sage,
              color: C.white,
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {t("paywall.locked.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
