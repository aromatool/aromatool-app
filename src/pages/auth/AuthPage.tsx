import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

type Mode = "login" | "register";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/app");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError("Email sau parolă incorectă.");
    } else {
      if (!fullName.trim()) {
        setError("Introdu numele tău.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Parola trebuie să aibă minim 6 caractere.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Parolele nu coincid.");
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) setError(error.message);
      else setSuccess("Cont creat! Verifică emailul pentru confirmare.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #FDFAFF 0%, #F0EAFF 50%, #E8F4FF 100%)",
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
              "radial-gradient(circle, rgba(196,168,232,0.3) 0%, transparent 70%)",
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
              "radial-gradient(circle, rgba(168,196,232,0.2) 0%, transparent 70%)",
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
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "32px",
              color: "#2D1A4E",
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
            <div
              style={{ height: "1px", width: "48px", background: "#C4A8E8" }}
            />
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#7B5EA7",
              }}
            />
            <div
              style={{ height: "1px", width: "48px", background: "#C4A8E8" }}
            />
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#9B80C4",
              fontStyle: "italic",
              letterSpacing: "2px",
            }}
          >
            crafted for your team
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 8px 40px rgba(123,94,167,0.12)",
            border: "1px solid rgba(196,168,232,0.3)",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              background: "#F5F0FF",
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
                  setError("");
                  setSuccess("");
                  setConfirmPassword("");
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
                  background: mode === m ? "white" : "transparent",
                  color: mode === m ? "#2D1A4E" : "#9B80C4",
                  boxShadow:
                    mode === m ? "0 1px 8px rgba(123,94,167,0.15)" : "none",
                }}
              >
                {m === "login" ? "Intră în cont" : "Cont nou"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#6B5B9E",
                    marginBottom: "6px",
                    letterSpacing: "0.04em",
                  }}
                >
                  NUMELE TĂU
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Cum te cheamă?"
                  required
                  style={inputStyle}
                  onFocus={(e) =>
                    Object.assign(e.target.style, inputFocusStyle)
                  }
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#6B5B9E",
                  marginBottom: "6px",
                  letterSpacing: "0.04em",
                }}
              >
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@tau.com"
                required
                style={inputStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => Object.assign(e.target.style, inputStyle)}
              />
            </div>

            <div
              style={{ marginBottom: mode === "register" ? "16px" : "24px" }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#6B5B9E",
                  marginBottom: "6px",
                  letterSpacing: "0.04em",
                }}
              >
                PAROLĂ
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "register" ? "Minim 6 caractere" : "••••••••"
                }
                required
                style={inputStyle}
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={(e) => Object.assign(e.target.style, inputStyle)}
              />
            </div>

            {mode === "register" && (
              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#6B5B9E",
                    marginBottom: "6px",
                    letterSpacing: "0.04em",
                  }}
                >
                  CONFIRMĂ PAROLA
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetă parola"
                  required
                  style={inputStyle}
                  onFocus={(e) =>
                    Object.assign(e.target.style, inputFocusStyle)
                  }
                  onBlur={(e) => Object.assign(e.target.style, inputStyle)}
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  background: "#FFF0F4",
                  border: "1px solid rgba(201,79,106,0.2)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#C94F6A",
                  marginBottom: "16px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: "#E8F8F0",
                  border: "1px solid rgba(46,138,88,0.2)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "#2E8A58",
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
                  ? "#C4A8E8"
                  : "linear-gradient(135deg, #7B5EA7, #4A3270)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontSize: "15px",
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.02em",
              }}
            >
              {loading
                ? "..."
                : mode === "login"
                  ? "Intră în cont →"
                  : "Creează cont →"}
            </button>
          </form>

          {mode === "login" && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <span style={{ fontSize: "13px", color: "#9B80C4" }}>
                Nu ai cont?{" "}
              </span>
              <button
                onClick={() => setMode("register")}
                style={{
                  fontSize: "13px",
                  color: "#7B5EA7",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Înregistrează-te gratuit
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "11px",
            color: "#C4A8E8",
          }}
        >
          14 zile trial gratuit · Fără card de credit
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "#F9F7FF",
  border: "1.5px solid rgba(196,168,232,0.4)",
  borderRadius: "10px",
  fontSize: "14px",
  color: "#2D1A4E",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const inputFocusStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: "#7B5EA7",
};
