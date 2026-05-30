import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#FDFAFF",
  card: "#FFFFFF",
  border: "rgba(196,168,232,0.3)",
  border2: "rgba(196,168,232,0.5)",
  primary: "#7B5EA7",
  dark: "#2D1A4E",
  muted: "#9B80C4",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  bg2: "#F5F0FF",
};

interface Profile {
  full_name: string;
  phone: string;
  contact_email: string;
  country_code: string;
  language_code: string;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: "",
    contact_email: "",
    country_code: "RO",
    language_code: "ro",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, contact_email, country_code, language_code")
      .eq("id", user!.id)
      .single();

    if (data) {
      setProfile({
        full_name: data.full_name || user?.user_metadata?.full_name || "",
        phone: data.phone || "",
        contact_email: data.contact_email || user?.email || "",
        country_code: data.country_code || "RO",
        language_code: data.language_code || "ro",
      });
    }
    setLoading(false);
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setSuccess(false);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        contact_email: profile.contact_email,
        country_code: profile.country_code,
        language_code: profile.language_code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user!.id);

    if (updateError) {
      setError("Eroare la salvare. Încearcă din nou.");
    } else {
      // Update auth metadata too
      await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          phone: profile.phone,
          contact_email: profile.contact_email,
        },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px" }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            border: "3px solid #E8E0F8",
            borderTopColor: C.primary,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "22px",
          color: C.dark,
          marginBottom: "24px",
        }}
      >
        Setări cont
      </div>

      {/* Profile info */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: C.primary,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "16px",
          }}
        >
          👤 Profil distribuitor
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Numele tău</label>
            <input
              value={profile.full_name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder="Nume Prenume"
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Telefon (WhatsApp)</label>
              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, phone: e.target.value }))
                }
                placeholder="+40712345678"
                style={inputStyle}
              />
              <div
                style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}
              >
                Apare în emailurile trimise clienților
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email contact</label>
              <input
                value={profile.contact_email}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, contact_email: e.target.value }))
                }
                placeholder="email@tau.com"
                style={inputStyle}
              />
              <div
                style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}
              >
                Apare în emailurile trimise clienților
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>Țara</label>
              <select
                value={profile.country_code}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, country_code: e.target.value }))
                }
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="RO">🇷🇴 România</option>
                <option value="DE">🇩🇪 Germania</option>
                <option value="FR">🇫🇷 Franța</option>
                <option value="GB">🇬🇧 Marea Britanie</option>
                <option value="US">🇺🇸 SUA</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Limba</label>
              <select
                value={profile.language_code}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, language_code: e.target.value }))
                }
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="ro">Română</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              background: C.redbg,
              border: `1px solid rgba(201,79,106,0.2)`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.red,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.green,
            }}
          >
            ✅ Salvat cu succes!
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "12px",
            background: saving
              ? C.muted
              : `linear-gradient(135deg, ${C.primary}, #4A3270)`,
            border: "none",
            borderRadius: "10px",
            color: "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Se salvează..." : "Salvează modificările"}
        </button>
      </div>

      {/* Account info */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: C.primary,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "16px",
          }}
        >
          🔐 Cont
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: "13px", color: C.muted }}>Email login</span>
          <span style={{ fontSize: "13px", color: C.dark, fontWeight: 500 }}>
            {user?.email}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: "13px", color: C.muted }}>Plan</span>
          <span
            style={{
              fontSize: "12px",
              background: C.bg2,
              color: C.primary,
              padding: "3px 10px",
              borderRadius: "999px",
              fontWeight: 500,
            }}
          >
            Trial gratuit
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
          }}
        >
          <span style={{ fontSize: "13px", color: C.muted }}>Cont creat</span>
          <span style={{ fontSize: "13px", color: C.dark }}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("ro-RO")
              : "—"}
          </span>
        </div>
      </div>

      {/* Danger zone */}
      <div
        style={{
          background: C.card,
          border: `1px solid rgba(201,79,106,0.2)`,
          borderRadius: "16px",
          padding: "24px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: C.red,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "16px",
          }}
        >
          ⚠️ Zona de pericol
        </div>
        <button
          onClick={() => {
            if (confirm("Ești sigur că vrei să ieși din cont?")) signOut();
          }}
          style={{
            width: "100%",
            padding: "11px",
            background: "#FFF0F4",
            border: "1px solid rgba(201,79,106,0.2)",
            borderRadius: "10px",
            color: C.red,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          🚪 Ieși din cont
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#6B5B9E",
  marginBottom: "6px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#F9F7FF",
  border: "1.5px solid rgba(196,168,232,0.4)",
  borderRadius: "10px",
  fontSize: "14px",
  color: "#2D1A4E",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
