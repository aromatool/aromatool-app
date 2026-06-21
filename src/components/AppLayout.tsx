import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { useSubscription } from "../lib/subscription";
import { supabase } from "../lib/supabase";
import FeedbackWidget from "./FeedbackWidget";
import WhatsAppButton from "./WhatsAppButton";
import LeafMark from "./LeafMark";

// ── BLOSSOM SAGE THEME ─────────────────────────────────────
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
  rose: "#D4A5A0",
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
  border: "#EDE8E0",
  borderMid: "#D8D0C8",
  white: "#FFFFFF",
};

interface AppLayoutProps {
  children: ReactNode;
}

// Bottom nav items — 4 items + FAB central
const NAV_LEFT = [
  { path: "/app/dashboard", icon: "ti-layout-dashboard", labelKey: "nav.home" },
  { path: "/app/contacts", icon: "ti-users", labelKey: "nav.crm" },
];
const NAV_RIGHT = [
  { path: "/app/offers", icon: "ti-file-text", labelKey: "nav.offers" },
  { path: "/app/more", icon: "ti-dots", labelKey: "nav.more" },
];
const ALL_NAV = [
  { path: "/app/dashboard", icon: "ti-layout-dashboard", labelKey: "nav.home" },
  { path: "/app/contacts", icon: "ti-users", labelKey: "nav.crm" },
  { path: "/app/calculator", icon: "ti-calculator", labelKey: "nav.buildOffer" },
  { path: "/app/offers", icon: "ti-file-text", labelKey: "nav.offers" },
  { path: "/app/resources", icon: "ti-folder", labelKey: "nav.resources" },
  { path: "/app/templates", icon: "ti-template", labelKey: "nav.messages" },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const sub = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (active) setIsAdmin(!!data?.is_admin);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setShowFabMenu(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.cream,
        fontFamily: "'DM Sans', Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── HEADER ───────────────────────────────────────── */}
      <header
        style={{
          background: T.white,
          borderBottom: `1px solid ${T.border}`,
          padding: "0 24px",
          height: "58px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          onClick={() => navigate("/app/dashboard")}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              background: T.sage,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LeafMark size={16} color="#FFFFFF" />
          </div>
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: T.espresso,
                letterSpacing: "-0.02em",
              }}
            >
              AromaTool
            </div>
            <div
              style={{
                fontSize: "9px",
                color: T.muted,
                letterSpacing: "0.08em",
                marginTop: "-1px",
              }}
            >
              crafted for your team
            </div>
          </div>
        </div>

        {/* Desktop nav */}
        <nav
          style={{
            display: "flex",
            gap: "2px",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
          className="desktop-nav"
        >
          {ALL_NAV.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  padding: "7px 14px",
                  border: "none",
                  borderRadius: "8px",
                  background: active ? T.sageLight : "transparent",
                  color: active ? T.sageDark : T.muted,
                  fontSize: "13px",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <i className={`ti ${item.icon}`} style={{ fontSize: "15px" }} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* User menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: T.sageLight,
              border: `1px solid ${T.sageMid}`,
              borderRadius: "999px",
              padding: "5px 12px 5px 5px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: T.sage,
                color: "white",
                fontSize: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initials}
            </div>
            <span
              style={{ fontSize: "13px", color: T.espresso, fontWeight: 500 }}
            >
              {displayName.split(" ")[0]}
            </span>
            <i
              className="ti ti-chevron-down"
              style={{ fontSize: "12px", color: T.muted }}
            />
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "42px",
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "12px",
                boxShadow: "0 8px 24px rgba(60,53,48,0.12)",
                padding: "8px",
                minWidth: "180px",
                zIndex: 300,
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${T.border}`,
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: T.espresso,
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}
                >
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => {
                  navigate("/app/settings");
                  setShowUserMenu(false);
                }}
                style={menuItemStyle}
              >
                <i
                  className="ti ti-settings"
                  style={{ fontSize: "15px", color: T.muted }}
                />
                {t("nav.accountSettings")}
              </button>
              <button
                onClick={() => {
                  navigate("/app/help");
                  setShowUserMenu(false);
                }}
                style={menuItemStyle}
              >
                <i
                  className="ti ti-help-circle"
                  style={{ fontSize: "15px", color: T.muted }}
                />
                {t("nav.helpGuide")}
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    navigate("/app/admin");
                    setShowUserMenu(false);
                  }}
                  style={menuItemStyle}
                >
                  <i
                    className="ti ti-shield-lock"
                    style={{ fontSize: "15px", color: T.muted }}
                  />
                  {t("nav.admin")}
                </button>
              )}
              <button
                onClick={() => {
                  signOut();
                  setShowUserMenu(false);
                }}
                style={{ ...menuItemStyle, color: "#C94F6A" }}
              >
                <i className="ti ti-logout" style={{ fontSize: "15px" }} />
                {t("nav.signOut")}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── BANNER ABONAMENT ─────────────────────────────── */}
      <SubscriptionBanner
        sub={sub}
        onAction={() => {
          // Dacă suntem deja pe Setări, derulăm la cardul Abonament (altfel
          // navigate("/app/settings") ar fi un no-op). De pe alte pagini,
          // navigăm cu hash-ul #subscription, pe care SettingsPage îl prinde
          // și derulează după montare.
          if (location.pathname === "/app/settings") {
            document
              .getElementById("subscription-card")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            navigate("/app/settings#subscription");
          }
        }}
      />

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          padding: "24px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
        className="main-content"
      >
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: T.white,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          padding: `8px 8px max(12px, env(safe-area-inset-bottom))`,
          zIndex: 100,
        }}
        className="mobile-nav"
      >
        {/* Left items */}
        {NAV_LEFT.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "6px 0",
                cursor: "pointer",
                minHeight: "44px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  background: active ? T.sageLight : "transparent",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                <i
                  className={`ti ${item.icon}`}
                  style={{
                    fontSize: "20px",
                    color: active ? T.sage : T.muted,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  lineHeight: 1,
                  color: active ? T.sage : T.muted,
                  whiteSpace: "nowrap",
                }}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}

        {/* FAB — central */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            position: "relative",
          }}
          ref={fabRef}
        >
          {/* FAB menu */}
          {showFabMenu && (
            <div
              style={{
                position: "absolute",
                bottom: "64px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "center",
                zIndex: 200,
              }}
            >
              <button
                onClick={() => {
                  navigate("/app/contacts");
                  setShowFabMenu(false);
                }}
                style={fabMenuItemStyle}
              >
                <i
                  className="ti ti-user-plus"
                  style={{ fontSize: "16px", color: T.sage }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    color: T.espresso,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("nav.newContact")}
                </span>
              </button>
              <button
                onClick={() => {
                  navigate("/app/calculator");
                  setShowFabMenu(false);
                }}
                style={fabMenuItemStyle}
              >
                <i
                  className="ti ti-calculator"
                  style={{ fontSize: "16px", color: T.lavender }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    color: T.espresso,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("nav.newOffer")}
                </span>
              </button>
            </div>
          )}

          {/* Leagăn rotunjit: bara se curbează în jurul FAB-ului (halou alb
              care iese ușor peste linia de sus a barei, ca să nu mai fie
              dreaptă în zona butonului +). */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "-28px",
              transform: "translateX(-50%)",
              width: "72px",
              height: "72px",
              background: T.white,
              borderRadius: "50%",
              boxShadow: "0 -3px 8px rgba(61,53,48,0.06)",
              zIndex: 0,
            }}
          />

          {/* FAB button */}
          <button
            onClick={() => setShowFabMenu(!showFabMenu)}
            style={{
              position: "relative",
              zIndex: 1,
              width: "52px",
              height: "52px",
              background: T.sage,
              border: "none",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(92,122,92,0.35)",
              transform: showFabMenu
                ? "translateY(-18px) rotate(45deg)"
                : "translateY(-18px) rotate(0deg)",
              transition: "transform 0.2s ease",
              marginBottom: "4px",
              flexShrink: 0,
            }}
          >
            <i
              className="ti ti-plus"
              style={{ fontSize: "24px", color: "white" }}
            />
          </button>
        </div>

        {/* Right items */}
        {NAV_RIGHT.map((item) => {
          const isMore = item.labelKey === "nav.more";

          // "Mai mult" — meniu cu paginile care nu încap în bară
          if (isMore) {
            const moreItems = [
              {
                path: "/app/resources",
                icon: "ti-folder",
                labelKey: "nav.resources",
              },
              {
                path: "/app/templates",
                icon: "ti-template",
                labelKey: "nav.messages",
              },
            ];
            const moreActive =
              showMoreMenu ||
              moreItems.some((mi) => isActive(mi.path));

            return (
              <div
                key={item.path}
                ref={moreRef}
                style={{
                  flex: 1,
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {showMoreMenu && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      right: 0,
                      background: T.white,
                      border: `1px solid ${T.border}`,
                      borderRadius: "14px",
                      boxShadow: "0 8px 28px rgba(61,53,48,0.16)",
                      padding: "6px",
                      minWidth: "190px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      zIndex: 200,
                    }}
                  >
                    {moreItems.map((mi) => {
                      const itemActive = isActive(mi.path);
                      return (
                        <button
                          key={mi.path}
                          onClick={() => {
                            navigate(mi.path);
                            setShowMoreMenu(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            width: "100%",
                            padding: "11px 12px",
                            border: "none",
                            background: itemActive ? T.sageLight : "transparent",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: 500,
                            fontFamily: "inherit",
                            textAlign: "left",
                            color: itemActive ? T.sage : T.espresso,
                          }}
                        >
                          <i
                            className={`ti ${mi.icon}`}
                            style={{
                              fontSize: "17px",
                              color: itemActive ? T.sage : T.muted,
                            }}
                          />
                          {t(mi.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={() => setShowMoreMenu((v) => !v)}
                  style={{
                    flex: 1,
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    padding: "6px 0",
                    cursor: "pointer",
                    minHeight: "44px",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      background: moreActive ? T.sageLight : "transparent",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <i
                      className={`ti ${item.icon}`}
                      style={{
                        fontSize: "20px",
                        color: moreActive ? T.sage : T.muted,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      lineHeight: 1,
                      color: moreActive ? T.sage : T.muted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                </button>
              </div>
            );
          }

          const effectiveActive = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "6px 0",
                cursor: "pointer",
                minHeight: "44px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  background: effectiveActive ? T.sageLight : "transparent",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                <i
                  className={`ti ${item.icon}`}
                  style={{
                    fontSize: "20px",
                    color: effectiveActive ? T.sage : T.muted,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  lineHeight: 1,
                  color: effectiveActive ? T.sage : T.muted,
                  whiteSpace: "nowrap",
                }}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* FAB backdrop */}
      {showFabMenu && (
        <div
          onClick={() => setShowFabMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(61,53,48,0.3)",
            zIndex: 99,
          }}
          className="mobile-nav-backdrop"
        />
      )}

      {/* More-menu backdrop (transparent tap-catcher) */}
      {showMoreMenu && (
        <div
          onClick={() => setShowMoreMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 99,
          }}
          className="mobile-nav-backdrop"
        />
      )}

      <style>{`
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');

        @media (max-width: 1024px) {
          .desktop-nav { display: none !important; }
          .main-content { padding: 16px 16px 90px !important; }
        }
        @media (min-width: 1025px) {
          .mobile-nav { display: none !important; }
          .mobile-nav-backdrop { display: none !important; }
        }
        * { box-sizing: border-box; }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <WhatsAppButton />
      <FeedbackWidget />
    </div>
  );
}

// ── BANNER ABONAMENT ────────────────────────────────────────
interface BannerSub {
  loading: boolean;
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isAdmin: boolean;
  freeAccess: boolean;
  hasAccess: boolean;
  daysLeft: number;
  openPaywall: () => void;
}

function SubscriptionBanner({
  sub,
  onAction,
}: {
  sub: BannerSub;
  onAction: () => void;
}) {
  const { t } = useTranslation();
  // Adminii și utilizatorii cu acces gratuit nu văd niciun banner.
  if (sub.loading || sub.isActive || sub.isAdmin || sub.freeAccess) return null;

  // Plată eșuată — prioritate maximă.
  if (sub.isPastDue) {
    return (
      <BannerBar
        bg="#FFF0F4"
        border="#F3C9D3"
        color="#A23A52"
        icon="ti-alert-triangle"
        text={t("nav.bannerPastDue")}
        cta={t("nav.bannerManage")}
        onClick={onAction}
      />
    );
  }

  // Trial activ — nu îl deranjăm pe user toată perioada. Afișăm un memento
  // prietenos DOAR în ultimele 3 zile, ca să anunțăm din timp expirarea.
  if (sub.isTrialing) {
    if (sub.daysLeft > 3) return null;
    return (
      <BannerBar
        bg="#FBF3E8"
        border="#E8D5B5"
        color="#9A6A2A"
        icon="ti-clock"
        text={
          sub.daysLeft === 1
            ? t("nav.bannerTrialExpiresTomorrow")
            : t("nav.bannerTrialDaysLeft", { days: sub.daysLeft })
        }
        cta={t("nav.bannerSeePlan")}
        onClick={onAction}
      />
    );
  }

  // Fără acces (trial expirat, fără abonament) — poarta blândă.
  if (!sub.hasAccess) {
    return (
      <BannerBar
        bg="#FBF3E8"
        border="#E8D5B5"
        color="#9A6A2A"
        icon="ti-lock"
        text={t("nav.bannerTrialEnded")}
        cta={t("nav.bannerSubscribe")}
        onClick={sub.openPaywall}
      />
    );
  }

  return null;
}

function BannerBar({
  bg,
  border,
  color,
  icon,
  text,
  cta,
  onClick,
}: {
  bg: string;
  border: string;
  color: string;
  icon: string;
  text: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        background: bg,
        borderBottom: `1px solid ${border}`,
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "13px",
        color,
        fontFamily: "'DM Sans', Inter, system-ui, sans-serif",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: "16px", flexShrink: 0 }} />
      <span style={{ flex: 1, lineHeight: 1.4 }}>{text}</span>
      <button
        onClick={onClick}
        style={{
          border: `1px solid ${color}`,
          background: "transparent",
          color,
          borderRadius: "8px",
          padding: "5px 12px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {cta}
      </button>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "none",
  background: "transparent",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#3D3530",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const fabMenuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "white",
  border: "0.5px solid #EDE8E0",
  borderRadius: "12px",
  padding: "10px 16px",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 4px 12px rgba(60,53,48,0.1)",
  whiteSpace: "nowrap",
};
