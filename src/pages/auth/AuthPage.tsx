import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth";

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
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
};

type Mode = "login" | "register" | "forgot";

export default function AuthPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  // După register reușit: emailul la care s-a trimis confirmarea (afișează
  // panoul „verifică-ți inboxul" în loc de formularul gol — fără dead-end).
  const [registeredEmail, setRegisteredEmail] = useState("");
  const { signIn, signUp, user, recovery, resetPassword, updatePassword } =
    useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Nu redirecționa cât timp userul setează o parolă nouă din link.
    if (user && !recovery) navigate("/app");
  }, [user, recovery, navigate]);

  function resetFields() {
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #FAFAF7 0%, #F0ECE4 45%, #E8F0E8 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-5%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(92,122,92,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-5%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(200,216,200,0.35) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "420px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "32px",
              color: T.espresso,
              letterSpacing: "-0.5px",
              marginBottom: "8px",
            }}
          >
            AromaTool
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <div style={{ height: "1px", width: "48px", background: T.sageMid }} />
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: T.sage,
              }}
            />
            <div style={{ height: "1px", width: "48px", background: T.sageMid }} />
          </div>
          <div
            style={{
              fontSize: "11px",
              color: T.muted,
              fontStyle: "italic",
              letterSpacing: "2px",
            }}
          >
            {t("auth.tagline")}
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: T.white,
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 8px 40px rgba(92,122,92,0.10)",
            border: `1px solid ${T.border}`,
          }}
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
                    padding: "9px",
                    border: "none",
                    borderRadius: "9px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.2s",
                    background: mode === m ? T.white : "transparent",
                    color: mode === m ? T.espresso : T.muted,
                    boxShadow:
                      mode === m ? "0 1px 8px rgba(92,122,92,0.15)" : "none",
                  }}
                >
                  {m === "login" ? t("auth.tabLogin") : t("auth.tabRegister")}
                </button>
              ))}
            </div>
          )}

          {/* Titlu */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: T.espresso,
              marginBottom: mode === "forgot" || recovery ? "6px" : "20px",
              textAlign: mode === "forgot" || recovery ? "center" : "left",
            }}
          >
            {heading}
          </div>
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
            {mode === "register" && !recovery && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>{t("auth.labelFullName")}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("auth.placeholderFullName")}
                  required
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
            )}

            {/* Email — la login/register/forgot (nu la recovery) */}
            {!recovery && (
              <div
                style={{
                  marginBottom: mode === "forgot" ? "24px" : "16px",
                }}
              >
                <label style={labelStyle}>{t("auth.labelEmail")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.placeholderEmail")}
                  required
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
            )}

            {/* Parolă — la login/register/recovery (nu la forgot) */}
            {mode !== "forgot" && (
              <div
                style={{
                  marginBottom:
                    mode === "register" || recovery ? "16px" : "10px",
                }}
              >
                <label style={labelStyle}>
                  {recovery ? t("auth.labelPasswordNew") : t("auth.labelPassword")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "register" || recovery
                      ? t("auth.placeholderPasswordMin")
                      : t("auth.placeholderPasswordDots")
                  }
                  required
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
            )}

            {/* Confirmă parola — la register/recovery */}
            {(mode === "register" || recovery) && (
              <div style={{ marginBottom: "24px" }}>
                <label style={labelStyle}>{t("auth.labelConfirmPassword")}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.placeholderConfirmPassword")}
                  required
                  style={inputStyle}
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
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
              style={{
                width: "100%",
                padding: "13px",
                background: loading
                  ? T.sageMid
                  : "linear-gradient(135deg, #5C7A5C, #4A6A4A)",
                border: "none",
                borderRadius: "12px",
                color: T.white,
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.02em",
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
        </div>

        {!recovery && mode !== "forgot" && registeredEmail === "" && (
          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "11px",
              color: T.muted,
            }}
          >
            {t("auth.trialNote")}
          </div>
        )}

        {/* Linkuri legale */}
        <div
          style={{
            textAlign: "center",
            marginTop: "14px",
            fontSize: "11px",
            color: T.muted,
            display: "flex",
            gap: "14px",
            justifyContent: "center",
          }}
        >
          <Link to="/legal/terms" style={{ color: T.muted }}>
            {t("auth.legalTerms")}
          </Link>
          <Link to="/legal/privacy" style={{ color: T.muted }}>
            {t("auth.legalPrivacy")}
          </Link>
          <Link to="/legal/cookies" style={{ color: T.muted }}>
            {t("auth.legalCookies")}
          </Link>
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
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: T.sage,
};
