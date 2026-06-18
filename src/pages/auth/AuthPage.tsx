import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { setUiLang, type Lang } from "../../i18n";
import { usePlanPrice } from "../../lib/subscription";
import LeafMark from "../../components/LeafMark";

// ── CALM PREMIUM WELLNESS (design system — doar /auth) ──────
const T = {
  sage: "#4F6F52", // Primary Green
  sageDark: "#3F5B42", // Dark Green
  sageLight: "#EAF0EA", // tentă deschisă (derivată)
  sageMid: "#CBD8CB", // tentă medie (derivată)
  cream: "#F8F7F4", // Background
  linen: "#F1EDE6", // fundal cald (derivat)
  espresso: "#2B2B2B", // Primary Text
  warm: "#6F6F6F", // Secondary Text
  muted: "#9A958C", // text terțiar (derivat)
  border: "#E7E3DD", // Borders
  white: "#FFFFFF", // Cards
  card: "#FFFDF9", // Card warm (panou mobil + inputuri)
  green: "#2E8A58", // success (păstrat)
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
};

type Mode = "login" | "register" | "forgot";

// Numele afișat al limbilor în selector.
const LANG_LABELS: Record<Lang, string> = {
  ro: "🇷🇴 Română",
  en: "🇬🇧 English",
};

// ── Iconițe inline (SVG, fără dependență de CDN/webfont) ──
type IconProps = {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
};

function StrokeIcon({
  size = 18,
  color = "currentColor",
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function IconGlobe(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <circle cx="12" cy="12" r="9" />
      <line x1="3.6" y1="9" x2="20.4" y2="9" />
      <line x1="3.6" y1="15" x2="20.4" y2="15" />
      <path d="M11.5 3a17 17 0 0 0 0 18" />
      <path d="M12.5 3a17 17 0 0 1 0 18" />
    </StrokeIcon>
  );
}

function IconChevron(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <path d="M6 9l6 6l6 -6" />
    </StrokeIcon>
  );
}

function IconCalendar(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="4" y1="11" x2="20" y2="11" />
    </StrokeIcon>
  );
}

function IconLock(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <circle cx="12" cy="16" r="1" />
      <path d="M8 11v-4a4 4 0 0 1 8 0v4" />
    </StrokeIcon>
  );
}

function IconShieldCheck(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <path d="M12 3l7 3v5c0 4.5 -3 7.6 -7 9c-4 -1.4 -7 -4.5 -7 -9v-5z" />
      <path d="M9 12l2 2l4 -4" />
    </StrokeIcon>
  );
}

function IconMail(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6l9 -6" />
    </StrokeIcon>
  );
}

function IconUser(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6 -6h4a6 6 0 0 1 6 6v1" />
    </StrokeIcon>
  );
}

function IconEye(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </StrokeIcon>
  );
}

function IconEyeOff(p: IconProps) {
  return (
    <StrokeIcon {...p}>
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.7 8.7 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9 9 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </StrokeIcon>
  );
}

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const uiLang: Lang = i18n.language?.startsWith("en") ? "en" : "ro";
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Acceptarea Termenilor + Confidențialității la înregistrare (obligatorie,
  // nebifată implicit → consimțământ activ, conform GDPR).
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  // După register reușit: emailul la care s-a trimis confirmarea (afișează
  // panoul „verifică-ți inboxul" în loc de formularul gol — fără dead-end).
  const [registeredEmail, setRegisteredEmail] = useState("");
  // Sub 860px ascundem panoul de brand din stânga și stivuim (mobil/tabletă).
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 860px)").matches
      : false,
  );
  // Micro-interacțiuni de hover (inline styles → fără :hover din CSS).
  const [btnHover, setBtnHover] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  // Dropdown selector de limbă (stil 🌐 globe + nume limbă + chevron).
  const [langOpen, setLangOpen] = useState(false);
  // Toggle vizibilitate parolă (eye icon) — doar pe inputurile mobile.
  const [showPassword, setShowPassword] = useState(false);
  // Zilele de trial configurate în Admin (app_config → trial_days).
  // Funcția SQL trial_days() e SECURITY DEFINER + grant pentru anon, deci
  // pagina de login (neautentificată) o poate apela direct. Implicit 15
  // (valoarea curentă din Admin) ca să nu pâlpâie 14 → 15 la încărcare.
  const [trialDays, setTrialDays] = useState<number>(15);
  // Preț live din Stripe (RON pt. RO, EUR pt. restul). `null` cât timp
  // se încarcă → nu afișăm linia de preț ca să nu pâlpâie.
  const { priceLabel } = usePlanPrice();
  const { signIn, signUp, user, recovery, resetPassword, updatePassword } =
    useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Nu redirecționa cât timp userul setează o parolă nouă din link.
    if (user && !recovery) navigate("/app");
  }, [user, recovery, navigate]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Preia numărul de zile de trial setat în Admin (fallback 15).
    let active = true;
    supabase.rpc("trial_days").then(({ data, error }) => {
      if (!active || error) return;
      const n = Number(data);
      if (Number.isFinite(n) && n > 0) setTrialDays(n);
    });
    return () => {
      active = false;
    };
  }, []);

  function resetFields() {
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setAcceptedTerms(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // ── SETEAZĂ PAROLĂ NOUĂ (venit din link de resetare) ──
    if (recovery) {
      if (password.length < 6) {
        setError(t("auth.errPasswordMin"));
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError(t("auth.errPasswordMismatch"));
        setLoading(false);
        return;
      }
      const { error } = await updatePassword(password);
      if (error) setError(error.message);
      else {
        setSuccess(t("auth.successPasswordChanged"));
        setTimeout(() => navigate("/app"), 1200);
      }
      setLoading(false);
      return;
    }

    // ── AM UITAT PAROLA ──
    if (mode === "forgot") {
      if (!email.trim()) {
        setError(t("auth.errEmailRequired"));
        setLoading(false);
        return;
      }
      const { error } = await resetPassword(email);
      if (error) setError(error.message);
      else setSuccess(t("auth.successResetSent"));
      setLoading(false);
      return;
    }

    // ── LOGIN ──
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(t("auth.errLoginInvalid"));
      setLoading(false);
      return;
    }

    // ── REGISTER ──
    if (!fullName.trim()) {
      setError(t("auth.errNameRequired"));
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errPasswordMin"));
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.errPasswordMismatch"));
      setLoading(false);
      return;
    }
    if (!acceptedTerms) {
      setError(t("auth.errTermsRequired"));
      setLoading(false);
      return;
    }
    const { error } = await signUp(email, password, fullName);
    if (error) setError(error.message);
    else setRegisteredEmail(email.trim());
    setLoading(false);
  };

  // Titlu + buton în funcție de context.
  const heading = recovery
    ? t("auth.headingRecovery")
    : mode === "login"
      ? t("auth.headingLogin")
      : mode === "register"
        ? t("auth.headingRegister")
        : t("auth.headingForgot");

  const submitLabel = recovery
    ? t("auth.submitRecovery")
    : mode === "login"
      ? t("auth.submitLogin")
      : mode === "register"
        ? t("auth.submitRegister")
        : t("auth.submitForgot");

  // Titlu centrat în modurile fără tab-uri (forgot / recovery).
  const centeredHead = mode === "forgot" || recovery;

  // ── Input reutilizabil ──────────────────────────────────────
  // Desktop: identic cu varianta veche (fără iconiță, stil compact).
  // Mobil: iconiță stânga + (opțional) eye-toggle dreapta, input înalt 56px.
  const renderField = (f: {
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    marginBottom: string;
    leftIcon?: React.ReactNode;
    isPassword?: boolean;
  }) => {
    const base = isMobile ? mInputStyle : inputStyle;
    const focus = isMobile ? mInputFocusStyle : inputFocusStyle;
    const extra: React.CSSProperties = {};
    if (isMobile && f.leftIcon) extra.paddingLeft = "46px";
    if (isMobile && f.isPassword) extra.paddingRight = "46px";
    const rest = { ...base, ...extra };
    const focused = { ...focus, ...extra };
    const inputType = f.isPassword && showPassword ? "text" : f.type;
    return (
      <div style={{ marginBottom: f.marginBottom }}>
        <label style={labelStyle}>{f.label}</label>
        <div style={{ position: "relative" }}>
          {isMobile && f.leftIcon && (
            <span
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                pointerEvents: "none",
              }}
            >
              {f.leftIcon}
            </span>
          )}
          <input
            type={inputType}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            required
            style={rest}
            onFocus={(e) => Object.assign(e.target.style, focused)}
            onBlur={(e) => Object.assign(e.target.style, rest)}
          />
          {isMobile && f.isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {showPassword ? (
                <IconEyeOff size={20} color={T.muted} />
              ) : (
                <IconEye size={20} color={T.muted} />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Linkuri legale (Termeni · Confidențialitate · Cookie-uri) ──
  const legalFooter = (
    <div
      style={{
        textAlign: "center",
        marginTop: "16px",
        fontSize: "12px",
        color: T.sage,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        justifyContent: "center",
      }}
    >
      {[
        { to: "/legal/terms", label: t("auth.legalTerms") },
        { to: "/legal/privacy", label: t("auth.legalPrivacy") },
        { to: "/legal/cookies", label: t("auth.legalCookies") },
      ].map((lnk, i) => (
        <span
          key={lnk.to}
          style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
        >
          {i > 0 && (
            <span style={{ color: T.sageMid, fontSize: "10px" }}>·</span>
          )}
          <Link
            to={lnk.to}
            onMouseEnter={() => setHoveredLink(lnk.to)}
            onMouseLeave={() => setHoveredLink(null)}
            style={{
              color: hoveredLink === lnk.to ? T.sageDark : T.sage,
              fontWeight: 500,
              textDecoration: "none",
              letterSpacing: "0.01em",
              transition: "color 0.18s",
            }}
          >
            {lnk.label}
          </Link>
        </span>
      ))}
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        fontFamily: "'Inter', sans-serif",
        background:
          "linear-gradient(135deg, #F8F7F4 0%, #F1EDE6 50%, #EAF0EA 100%)",
      }}
    >
      {/* Selector limbă — dropdown 🌐 (accesibil înainte de login, default RO). */}
      <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 20 }}>
        <button
          type="button"
          onClick={() => setLangOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={langOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 12px",
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            color: T.espresso,
            boxShadow: "0 4px 16px rgba(63,91,66,0.10)",
          }}
        >
          <IconGlobe size={16} color={T.sage} />
          {LANG_LABELS[uiLang]}
          <IconChevron
            size={14}
            color={T.muted}
            style={{
              transform: langOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {langOpen && (
          <>
            <div
              onClick={() => setLangOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1,
                background: "transparent",
              }}
            />
            <div
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 2,
                minWidth: "150px",
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "12px",
                padding: "4px",
                boxShadow: "0 10px 30px rgba(61,53,48,0.14)",
              }}
            >
              {(["ro", "en"] as Lang[]).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  role="option"
                  aria-selected={uiLang === lng}
                  onClick={() => {
                    setUiLang(lng);
                    setLangOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: uiLang === lng ? 600 : 500,
                    fontFamily: "'Inter', sans-serif",
                    textAlign: "left",
                    background: uiLang === lng ? T.sageLight : "transparent",
                    color: uiLang === lng ? T.sageDark : T.warm,
                  }}
                >
                  {LANG_LABELS[lng]}
                  {uiLang === lng && (
                    <span style={{ color: T.sage, fontSize: "13px" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── PANOU BRAND (stânga, doar desktop) ── */}
      {!isMobile && (
        <div
          style={{
            flex: "0 0 46%",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "32px",
            padding: "56px",
            background:
              "linear-gradient(160deg, #5D7D5E 0%, #4F6F52 55%, #3F5B42 100%)",
            color: T.white,
          }}
        >
          {/* cercuri decorative */}
          <div
            style={{
              position: "absolute",
              top: "-12%",
              left: "-10%",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-15%",
              right: "-8%",
              width: "380px",
              height: "380px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, maxWidth: "440px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "40px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LeafMark size={24} color={T.white} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "28px",
                    fontWeight: 700,
                    letterSpacing: "-0.5px",
                    lineHeight: 1.05,
                  }}
                >
                  AromaTool
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.75)",
                    fontStyle: "italic",
                    letterSpacing: "2px",
                    marginTop: "3px",
                  }}
                >
                  {t("auth.tagline")}
                </div>
              </div>
            </div>

            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "34px",
                lineHeight: 1.22,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: "0 0 16px",
              }}
            >
              {t("auth.heroTitle")}
            </h1>
            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.85)",
                margin: "0 0 32px",
              }}
            >
              {t("auth.heroSubtitle")}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginBottom: "40px",
              }}
            >
              {[
                t("auth.heroFeat1"),
                t("auth.heroFeat2"),
                t("auth.heroFeat3"),
              ].map((f, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <span
                    style={{ fontSize: "14px", color: "rgba(255,255,255,0.92)" }}
                  >
                    {f}
                  </span>
                </div>
              ))}
            </div>

            {/* Badge trial — iconiță calendar + zilele setate în Admin */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "13px",
                padding: "12px 18px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.20)",
                width: "fit-content",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconCalendar size={20} color={T.white} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: T.white,
                    letterSpacing: "0.01em",
                  }}
                >
                  {t("auth.trialBadgeTitle", { days: trialDays })}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "rgba(255,255,255,0.72)",
                    marginTop: "3px",
                  }}
                >
                  {t("auth.trialBadgeSub")}
                </div>
                {priceLabel && (
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.92)",
                      marginTop: "5px",
                    }}
                  >
                    {t("auth.trialBadgePrice", { price: priceLabel })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cele 3 carduri de încredere — jos pe panoul stâng */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              gap: "16px",
            }}
          >
            {[
              { icon: <IconLock size={20} color="rgba(255,255,255,0.95)" />, label: t("auth.trustCard1") },
              { icon: <IconShieldCheck size={20} color="rgba(255,255,255,0.95)" />, label: t("auth.trustCard2") },
              { icon: <LeafMark size={20} color="rgba(255,255,255,0.95)" />, label: t("auth.trustCard3") },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "11px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.20)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {c.icon}
                </div>
                <span
                  style={{
                    fontSize: "12.5px",
                    lineHeight: 1.35,
                    fontWeight: 600,
                    letterSpacing: "0.01em",
                    color: "rgba(255,255,255,0.78)",
                  }}
                >
                  {c.label}
                </span>
              </div>
            ))}
          </div>

          {/* Preview aplicație — mockup subtil, sugerează produsul real */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "150px",
              right: "-46px",
              width: "300px",
              zIndex: 0,
              opacity: 0.4,
              filter: "blur(1px)",
              transform: "rotate(-3deg)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                borderRadius: "14px",
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "12px",
                boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
              }}
            >
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.4)",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div
                  style={{
                    width: "44px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: "8px",
                        borderRadius: "4px",
                        background: `rgba(255,255,255,${i === 0 ? 0.4 : 0.2})`,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: "34px",
                          borderRadius: "8px",
                          background: "rgba(255,255,255,0.16)",
                        }}
                      />
                    ))}
                  </div>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px",
                        borderRadius: "8px",
                        background: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.25)",
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "3px",
                          background: "rgba(255,255,255,0.2)",
                        }}
                      />
                      <div
                        style={{
                          width: "30px",
                          height: "6px",
                          borderRadius: "3px",
                          background: "rgba(255,255,255,0.16)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── ZONA FORMULAR (desktop: coloană dreapta · mobil: hero + panou) ── */}
      <div
        style={
          isMobile
            ? {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                width: "100%",
              }
            : {
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px",
              }
        }
      >
        {/* ── HERO VERDE (doar mobil) — logo, titlu, beneficii ── */}
        {isMobile && (
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background:
                "radial-gradient(circle at top left, #5D7D5E 0%, #4F6F52 45%, #35533A 100%)",
              color: "#F8F8F5",
              padding: "calc(env(safe-area-inset-top, 0px) + 56px) 24px 44px",
            }}
          >
            {/* Frunză decorativă — filigran subtil din marca brandului */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                bottom: "-10px",
                right: "-30px",
                opacity: 0.06,
                transform: "rotate(18deg)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            >
              <LeafMark size={180} color={T.white} strokeWidth={0.8} />
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "26px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <LeafMark size={24} color={T.white} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "24px",
                    fontWeight: 700,
                    lineHeight: 1.05,
                    letterSpacing: "-0.5px",
                  }}
                >
                  AromaTool
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.75)",
                    fontStyle: "italic",
                    letterSpacing: "2px",
                    marginTop: "2px",
                  }}
                >
                  {t("auth.tagline")}
                </div>
              </div>
            </div>

            <h1
              style={{
                position: "relative",
                zIndex: 1,
                fontFamily: "'Playfair Display', serif",
                fontSize: "32px",
                lineHeight: 1.2,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                margin: "0 0 12px",
                maxWidth: "360px",
              }}
            >
              {t("auth.heroTitle")}
            </h1>
            <p
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: "15px",
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.85)",
                margin: "0 0 24px",
                maxWidth: "360px",
              }}
            >
              {t("auth.heroSubtitle")}
            </p>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                t("auth.heroFeat1"),
                t("auth.heroFeat2"),
                t("auth.heroFeat3"),
              ].map((f, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <span
                    style={{ fontSize: "14px", color: "rgba(255,255,255,0.92)" }}
                  >
                    {f}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wrapper conținut — desktop: lățime fixă centrată · mobil: full-width */}
        <div
          style={
            isMobile
              ? {
                  width: "100%",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }
              : { width: "100%", maxWidth: "420px" }
          }
        >
        {/* Card (desktop) / Panou alb rotunjit care urcă peste hero (mobil) */}
        <div
          style={
            isMobile
              ? {
                  flex: 1,
                  background: T.card,
                  borderRadius: "28px 28px 0 0",
                  marginTop: "-22px",
                  boxShadow: "0 -20px 60px rgba(0,0,0,0.10)",
                  padding:
                    "28px 22px calc(env(safe-area-inset-bottom, 0px) + 28px)",
                  position: "relative",
                  zIndex: 1,
                }
              : {
                  background: T.white,
                  borderRadius: "20px",
                  padding: "36px 32px",
                  boxShadow: "0 12px 48px rgba(63,91,66,0.10)",
                  border: `1px solid ${T.border}`,
                }
          }
        >
          {/* După register: panou „verifică-ți emailul" în loc de formular. */}
          {registeredEmail && !recovery ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>📬</div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: T.espresso,
                  marginBottom: "10px",
                }}
              >
                {t("auth.confirmHeading")}
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: T.warm,
                  lineHeight: 1.6,
                  marginBottom: "16px",
                }}
              >
                {t("auth.confirmBody", { email: registeredEmail })}
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: T.muted,
                  lineHeight: 1.6,
                  marginBottom: "22px",
                }}
              >
                {t("auth.confirmSpamHint")}
              </p>
              <button
                onClick={() => {
                  setRegisteredEmail("");
                  setMode("login");
                  resetFields();
                }}
                style={{
                  fontSize: "14px",
                  color: T.sage,
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {t("auth.confirmBackToLogin")}
              </button>
            </div>
          ) : (
          <>
          {/* Tabs — ascunse în modurile forgot/recovery */}
          {!recovery && mode !== "forgot" && (
            <div
              style={{
                display: "flex",
                background: T.cream,
                borderRadius: "12px",
                padding: "4px",
                marginBottom: "28px",
              }}
            >
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    resetFields();
                  }}
                  style={{
                    flex: 1,
                    padding: isMobile ? "13px" : "9px",
                    border: "none",
                    borderRadius: "9px",
                    cursor: "pointer",
                    fontSize: isMobile ? "15px" : "14px",
                    fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    transition: "all 0.2s",
                    background: mode === m ? T.white : "transparent",
                    color: mode === m ? T.espresso : T.muted,
                    boxShadow:
                      mode === m ? "0 1px 8px rgba(63,91,66,0.12)" : "none",
                  }}
                >
                  {m === "login" ? t("auth.tabLogin") : t("auth.tabRegister")}
                </button>
              ))}
            </div>
          )}

          {/* Titlu */}
          {isMobile ? (
            <>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: T.espresso,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                  marginBottom: "6px",
                  textAlign: centeredHead ? "center" : "left",
                }}
              >
                {heading}
              </div>
              {!recovery && mode !== "forgot" && (
                <div
                  style={{
                    fontSize: "14px",
                    color: T.warm,
                    lineHeight: 1.5,
                    marginBottom: "22px",
                  }}
                >
                  {mode === "login"
                    ? t("auth.subtitleLogin")
                    : t("auth.subtitleRegister")}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: T.espresso,
                marginBottom: centeredHead ? "6px" : "20px",
                textAlign: centeredHead ? "center" : "left",
              }}
            >
              {heading}
            </div>
          )}
          {mode === "forgot" && !recovery && (
            <div
              style={{
                fontSize: "13px",
                color: T.muted,
                lineHeight: 1.6,
                textAlign: "center",
                marginBottom: "22px",
              }}
            >
              {t("auth.forgotIntro")}
            </div>
          )}
          {recovery && (
            <div
              style={{
                fontSize: "13px",
                color: T.muted,
                lineHeight: 1.6,
                textAlign: "center",
                marginBottom: "22px",
              }}
            >
              {t("auth.recoveryIntro")}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Nume — doar la register */}
            {mode === "register" &&
              !recovery &&
              renderField({
                label: t("auth.labelFullName"),
                type: "text",
                value: fullName,
                onChange: setFullName,
                placeholder: t("auth.placeholderFullName"),
                marginBottom: "16px",
                leftIcon: <IconUser size={20} color={T.muted} />,
              })}

            {/* Email — la login/register/forgot (nu la recovery) */}
            {!recovery &&
              renderField({
                label: t("auth.labelEmail"),
                type: "email",
                value: email,
                onChange: setEmail,
                placeholder: t("auth.placeholderEmail"),
                marginBottom: mode === "forgot" ? "24px" : "16px",
                leftIcon: <IconMail size={20} color={T.muted} />,
              })}

            {/* Parolă — la login/register/recovery (nu la forgot) */}
            {mode !== "forgot" &&
              renderField({
                label: recovery
                  ? t("auth.labelPasswordNew")
                  : t("auth.labelPassword"),
                type: "password",
                value: password,
                onChange: setPassword,
                placeholder:
                  mode === "register" || recovery
                    ? t("auth.placeholderPasswordMin")
                    : t("auth.placeholderPasswordDots"),
                marginBottom: mode === "register" || recovery ? "16px" : "10px",
                leftIcon: <IconLock size={20} color={T.muted} />,
                isPassword: true,
              })}

            {/* Confirmă parola — la register/recovery */}
            {(mode === "register" || recovery) &&
              renderField({
                label: t("auth.labelConfirmPassword"),
                type: "password",
                value: confirmPassword,
                onChange: setConfirmPassword,
                placeholder: t("auth.placeholderConfirmPassword"),
                marginBottom: "24px",
                leftIcon: <IconLock size={20} color={T.muted} />,
                isPassword: true,
              })}

            {/* Acceptare Termeni + Confidențialitate — doar la register */}
            {mode === "register" && !recovery && (
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "20px",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  lineHeight: 1.55,
                  color: T.warm,
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{
                    width: "16px",
                    height: "16px",
                    marginTop: "1px",
                    accentColor: T.sage,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <span>
                  {t("auth.agreePre")}
                  <Link
                    to="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: T.sage, fontWeight: 600 }}
                  >
                    {t("auth.agreeTerms")}
                  </Link>
                  {t("auth.agreeMid")}
                  <Link
                    to="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: T.sage, fontWeight: 600 }}
                  >
                    {t("auth.agreePrivacy")}
                  </Link>
                  {t("auth.agreePost")}
                </span>
              </label>
            )}

            {/* Link „am uitat parola" — doar la login */}
            {mode === "login" && !recovery && (
              <div style={{ textAlign: "right", marginBottom: "20px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    resetFields();
                  }}
                  style={{
                    fontSize: "12px",
                    color: T.sage,
                    fontWeight: 500,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: T.redLight,
                  border: "1px solid rgba(201,79,106,0.2)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: T.red,
                  marginBottom: "16px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: T.greenLight,
                  border: "1px solid rgba(46,138,88,0.2)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: T.green,
                  marginBottom: "16px",
                }}
              >
                ✅ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                width: "100%",
                minHeight: isMobile ? "56px" : undefined,
                padding: isMobile ? "0 16px" : "13px",
                background: loading
                  ? T.sageMid
                  : "linear-gradient(135deg, #5D7D5E, #4F6F52)",
                border: "none",
                borderRadius: isMobile ? "14px" : "12px",
                color: T.white,
                fontSize: isMobile ? "16px" : "15px",
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.02em",
                transform:
                  btnHover && !loading ? "translateY(-1px)" : "translateY(0)",
                boxShadow:
                  btnHover && !loading
                    ? "0 10px 24px rgba(79,111,82,0.30)"
                    : "0 2px 8px rgba(79,111,82,0.16)",
              }}
            >
              {loading ? "..." : submitLabel}
            </button>
          </form>

          {/* Înapoi la login din forgot */}
          {mode === "forgot" && !recovery && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                onClick={() => {
                  setMode("login");
                  resetFields();
                }}
                style={{
                  fontSize: "13px",
                  color: T.sage,
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {t("auth.backToLogin")}
              </button>
            </div>
          )}

          {mode === "login" && !recovery && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <span style={{ fontSize: "13px", color: T.muted }}>
                {t("auth.noAccount")}
              </span>
              <button
                onClick={() => {
                  setMode("register");
                  resetFields();
                }}
                style={{
                  fontSize: "13px",
                  color: T.sage,
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {t("auth.registerFree")}
              </button>
            </div>
          )}
          </>
          )}

          {/* Trial card — doar mobil, sub formular (nu pe confirmare) */}
          {isMobile &&
            !recovery &&
            mode !== "forgot" &&
            registeredEmail === "" && (
              <>
                <div
                  style={{
                    height: "1px",
                    background: T.border,
                    margin: "24px 0 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "13px",
                    marginTop: "20px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: T.sageLight,
                    border: `1px solid ${T.sageMid}`,
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "11px",
                      background: T.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconCalendar size={20} color={T.sage} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: T.sageDark,
                      }}
                    >
                      {t("auth.trialBadgeTitle", { days: trialDays })}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: T.warm,
                        marginTop: "2px",
                      }}
                    >
                      {t("auth.trialBadgeSub")}
                    </div>
                    {priceLabel && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: T.sageDark,
                          marginTop: "4px",
                        }}
                      >
                        {t("auth.trialBadgePrice", { price: priceLabel })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          {/* Mesaj de încredere — doar mobil, centrat sub panou */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "20px",
                color: T.muted,
              }}
            >
              <IconLock size={15} color={T.muted} />
              <span style={{ fontSize: "12.5px", fontWeight: 500 }}>
                {t("auth.trustCard1")}
              </span>
            </div>
          )}

          {/* Linkuri legale — în interiorul panoului pe mobil */}
          {isMobile && legalFooter}
        </div>

        {/* Linkuri legale — sub card pe desktop */}
        {!isMobile && legalFooter}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: T.warm,
  marginBottom: "6px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: T.cream,
  border: `1.5px solid ${T.border}`,
  borderRadius: "10px",
  fontSize: "14px",
  color: T.espresso,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: T.sage,
};

// ── Inputuri mobile: ≥56px înălțime + 16px font (evită zoom-ul iOS),
// fundal cald, colțuri 14px, loc pentru iconiță stânga + eye dreapta. ──
const mInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "56px",
  padding: "0 16px",
  background: T.card,
  border: `1.5px solid ${T.border}`,
  borderRadius: "14px",
  fontSize: "16px",
  color: T.espresso,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const mInputFocusStyle: React.CSSProperties = {
  ...mInputStyle,
  borderColor: T.sage,
};
