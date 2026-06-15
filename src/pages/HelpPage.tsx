import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { COMPANY } from "./legal/Legal";

// ── BLOSSOM SAGE ───────────────────────────────────────────
const T = {
  sage: "#5C7A5C",
  sageDark: "#4A6A4A",
  sageLight: "#E8F0E8",
  sageMid: "#C8D8C8",
  cream: "#FAFAF7",
  linen: "#F5EEE8",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  amber: "#C4906A",
  amberLight: "#FDF5EE",
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
};

// ── STATUS + ACȚIUNI: culori/iconițe identice cu Dashboard & CRM ──
// (statusGroup → pill în ContactsPage; actionVisual → idem)
const STATUS_VISUAL: { key: string; color: string; bg: string }[] = [
  { key: "prospect", color: T.amber, bg: T.amberLight },
  { key: "client", color: T.green, bg: T.greenLight },
  { key: "team", color: T.lavender, bg: T.lavenderLight },
  { key: "inactive", color: T.muted, bg: T.linen },
];

const ACTION_VISUAL: { key: string; icon: string; color: string; bg: string }[] = [
  { key: "reactivate", icon: "ti-refresh", color: T.red, bg: T.redLight },
  { key: "needs_offer", icon: "ti-send", color: T.amber, bg: T.amberLight },
  { key: "needs_followup", icon: "ti-mail", color: T.amber, bg: T.amberLight },
  { key: "discuss_business", icon: "ti-users-group", color: T.green, bg: T.greenLight },
  { key: "awaiting_reply", icon: "ti-clock", color: T.lavender, bg: T.lavenderLight },
  { key: "none", icon: "ti-circle-check", color: T.green, bg: T.greenLight },
];

interface HelpItem {
  q: string;
  a: string; // text simplu, \n = paragraf nou
}

interface HelpCategory {
  icon: string;
  title: string;
  items: HelpItem[];
}

// ── CONȚINUT AJUTOR ────────────────────────────────────────
// Conținutul (titluri + întrebări/răspunsuri) vine din i18n
// (help.json). Aici păstrăm doar maparea cheie→icon și ordinea
// categoriilor. Adaugi o categorie nouă: o cheie aici + în JSON.
const CATEGORY_ICONS: { key: string; icon: string }[] = [
  { key: "quickStart", icon: "ti-sparkles" },
  { key: "buildOffer", icon: "ti-calculator" },
  { key: "sentOffers", icon: "ti-file-text" },
  { key: "crm", icon: "ti-users" },
  { key: "messages", icon: "ti-template" },
  { key: "resources", icon: "ti-folder" },
  { key: "subscription", icon: "ti-credit-card" },
  { key: "settings", icon: "ti-settings" },
];

// ── GHID VIZUAL: statusuri + acțiuni ───────────────────────
// Explică non-tehnic de ce un contact e într-un status și de ce
// are acțiunea aceea. Culorile = aceleași ca în Dashboard/CRM.
function StatusGuide() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: T.white,
        border: `0.5px solid ${T.border}`,
        borderRadius: "16px",
        padding: "22px",
        marginBottom: "24px",
      }}
    >
      {/* Titlu */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "9px",
            background: T.sageLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className="ti ti-route" style={{ fontSize: "17px", color: T.sage }} />
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: T.espresso }}>
          {t("help.guide.title")}
        </div>
      </div>
      <div style={{ fontSize: "13px", color: T.muted, lineHeight: 1.6, marginBottom: "20px", paddingLeft: "42px" }}>
        {t("help.guide.subtitle")}
      </div>

      {/* ── STATUSURI ── */}
      <div style={{ fontSize: "13px", fontWeight: 600, color: T.sageDark, marginBottom: "4px" }}>
        {t("help.guide.statusHeading")}
      </div>
      <div style={{ fontSize: "12.5px", color: T.muted, lineHeight: 1.6, marginBottom: "14px" }}>
        {t("help.guide.statusIntro")}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        {STATUS_VISUAL.map((s) => (
          <div
            key={s.key}
            style={{
              border: `0.5px solid ${T.border}`,
              borderLeft: `3px solid ${s.color}`,
              borderRadius: "12px",
              padding: "13px 14px",
              background: T.cream,
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontSize: "11.5px",
                fontWeight: 600,
                color: s.color,
                background: s.bg,
                padding: "3px 10px",
                borderRadius: "999px",
                marginBottom: "8px",
              }}
            >
              {t(`help.guide.statuses.${s.key}.label`)}
            </span>
            <div style={{ fontSize: "13px", fontWeight: 500, color: T.espresso, lineHeight: 1.5, marginBottom: "4px" }}>
              {t(`help.guide.statuses.${s.key}.meaning`)}
            </div>
            <div style={{ fontSize: "12px", color: T.warm, lineHeight: 1.55 }}>
              {t(`help.guide.statuses.${s.key}.how`)}
            </div>
          </div>
        ))}
      </div>

      {/* ── ACȚIUNI ── */}
      <div style={{ fontSize: "13px", fontWeight: 600, color: T.sageDark, marginBottom: "4px" }}>
        {t("help.guide.actionHeading")}
      </div>
      <div style={{ fontSize: "12.5px", color: T.muted, lineHeight: 1.6, marginBottom: "14px" }}>
        {t("help.guide.actionIntro")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ACTION_VISUAL.map((a) => (
          <div
            key={a.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              border: `0.5px solid ${T.border}`,
              borderRadius: "12px",
              padding: "12px 14px",
              background: T.cream,
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "9px",
                background: a.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              <i className={`ti ${a.icon}`} style={{ fontSize: "15px", color: a.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, color: a.color, marginBottom: "2px" }}>
                {t(`help.guide.actions.${a.key}.label`)}
              </div>
              <div style={{ fontSize: "12.5px", color: T.warm, lineHeight: 1.55 }}>
                {t(`help.guide.actions.${a.key}.when`)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Notă agendă ── */}
      <div
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "flex-start",
          gap: "9px",
          background: T.sageLight,
          border: `0.5px solid ${T.sageMid}`,
          borderRadius: "12px",
          padding: "12px 14px",
        }}
      >
        <i className="ti ti-calendar-event" style={{ fontSize: "16px", color: T.sage, flexShrink: 0, marginTop: "1px" }} />
        <div style={{ fontSize: "12.5px", color: T.sageDark, lineHeight: 1.6 }}>
          {t("help.guide.agendaNote")}
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const HELP: HelpCategory[] = useMemo(
    () =>
      CATEGORY_ICONS.map(({ key, icon }) => ({
        icon,
        title: t(`help.categories.${key}.title`),
        items: t(`help.categories.${key}.items`, {
          returnObjects: true,
        }) as HelpItem[],
      })),
    [t],
  );

  const q = search.trim().toLowerCase();

  // Filtrare: păstrăm categoriile, dar arătăm doar item-urile care se potrivesc.
  const results = useMemo(() => {
    if (!q) return HELP;
    return HELP.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [q, HELP]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalMatches = results.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="help-page">
      <style>{`
        @media (max-width: 768px) {
          .help-page input, .help-page textarea, .help-page select { font-size: 16px !important; }
        }
      `}</style>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: 500, color: T.espresso }}>
          {t("help.pageTitle")}
        </div>
        <div style={{ fontSize: "13px", color: T.muted, marginTop: "4px" }}>
          {t("help.pageSubtitle")}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: T.muted,
          }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("help.searchPlaceholder")}
          style={{
            width: "100%",
            padding: "11px 12px 11px 38px",
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: T.espresso,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Ghid vizual statusuri + acțiuni (ascuns în timpul căutării) */}
      {!q && <StatusGuide />}

      {/* Rezultate goale */}
      {q && totalMatches === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${T.border}`,
            borderRadius: "16px",
            background: T.white,
          }}
        >
          <i
            className="ti ti-help-circle"
            style={{
              fontSize: "40px",
              color: T.muted,
              display: "block",
              marginBottom: "12px",
            }}
          />
          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: T.espresso,
              marginBottom: "6px",
            }}
          >
            {t("help.noResultsTitle", { search })}
          </div>
          <div style={{ fontSize: "13px", color: T.muted }}>
            {t("help.noResultsSub")}
          </div>
        </div>
      ) : (
        results.map((cat) => (
          <div key={cat.title} style={{ marginBottom: "22px" }}>
            {/* Titlu categorie */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: T.sageLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i
                  className={`ti ${cat.icon}`}
                  style={{ fontSize: "16px", color: T.sage }}
                />
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: T.espresso,
                }}
              >
                {cat.title}
              </div>
            </div>

            {/* Item-uri (accordion) */}
            <div
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {cat.items.map((it, i) => {
                const id = `${cat.title}-${i}`;
                const isOpen = open.has(id) || !!q; // la căutare, deschidem direct
                return (
                  <div
                    key={id}
                    style={{
                      borderTop: i > 0 ? `0.5px solid ${T.border}` : "none",
                    }}
                  >
                    <div
                      onClick={() => toggle(id)}
                      style={{
                        padding: "14px 16px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: "14px",
                          fontWeight: 500,
                          color: T.espresso,
                        }}
                      >
                        {it.q}
                      </span>
                      <i
                        className={`ti ti-chevron-${isOpen ? "up" : "down"}`}
                        style={{
                          fontSize: "16px",
                          color: T.muted,
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    {isOpen && (
                      <div
                        style={{
                          padding: "0 16px 16px",
                        }}
                      >
                        {it.a.split("\n").map((p, j) => (
                          <p
                            key={j}
                            style={{
                              margin: j === 0 ? "0" : "8px 0 0",
                              fontSize: "13px",
                              lineHeight: 1.7,
                              color: T.warm,
                            }}
                          >
                            {p}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Footer contact */}
      <div
        style={{
          marginTop: "28px",
          background: T.sageLight,
          border: `0.5px solid ${T.sageMid}`,
          borderRadius: "14px",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: T.sageDark,
            marginBottom: "4px",
          }}
        >
          {t("help.footerTitle")}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: T.warm,
            marginBottom: "14px",
          }}
        >
          {t("help.footerSub")}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <button
            onClick={() => navigate("/app/settings")}
            style={{
              padding: "9px 18px",
              fontSize: "13px",
              fontFamily: "inherit",
              fontWeight: 500,
              background: T.white,
              border: `0.5px solid ${T.sageMid}`,
              borderRadius: "10px",
              color: T.sageDark,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i className="ti ti-settings" style={{ fontSize: "15px" }} />
            {t("help.footerButton")}
          </button>
          <a
            href={`mailto:${COMPANY.contactEmail}?subject=${encodeURIComponent(
              t("help.footerContactSubject"),
            )}`}
            style={{
              padding: "9px 18px",
              fontSize: "13px",
              fontFamily: "inherit",
              fontWeight: 500,
              background: T.sageDark,
              border: `0.5px solid ${T.sageDark}`,
              borderRadius: "10px",
              color: T.white,
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i className="ti ti-mail" style={{ fontSize: "15px" }} />
            {t("help.footerContactButton")}
          </a>
        </div>
      </div>
    </div>
  );
}
