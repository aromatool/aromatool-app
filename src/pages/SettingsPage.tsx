import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { COUNTRIES, flagOf } from "../lib/countries";
import PhoneInput from "../components/PhoneInput";

// Declanșează descărcarea unui fișier în browser.
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Escapează o valoare pentru CSV (RFC 4180).
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Blossom Sage — temă unică pe tot app-ul.
const C = {
  bg: "#FAFAF7",
  card: "#FFFFFF",
  border: "#EDE8E0",
  border2: "#EDE8E0",
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  bg2: "#F5EEE8",
};

interface Profile {
  full_name: string;
  phone: string;
  contact_email: string;
  email_signature: string;
  country_code: string;
  language_code: string;
  follow_up_days: number;
  daily_focus_enabled: boolean;
  daily_focus_hour: number;
  is_admin: boolean;
}

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth();
  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    phone: "",
    contact_email: "",
    email_signature: "",
    country_code: "RO",
    language_code: "ro",
    follow_up_days: 5,
    daily_focus_enabled: false,
    daily_focus_hour: 8,
    is_admin: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Schimbare parolă
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function changePassword() {
    setPwError("");
    setPwSuccess(false);
    if (pw1.length < 6) {
      setPwError("Parola trebuie să aibă minim 6 caractere.");
      return;
    }
    if (pw1 !== pw2) {
      setPwError("Parolele nu coincid.");
      return;
    }
    setPwSaving(true);
    const { error: pwErr } = await updatePassword(pw1);
    setPwSaving(false);
    if (pwErr) {
      setPwError("Eroare la schimbarea parolei. Încearcă din nou.");
    } else {
      setPw1("");
      setPw2("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    }
  }

  // ── Export date ────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  async function exportContactsCsv() {
    setExporting(true);
    const { data } = await supabase
      .from("contacts")
      .select(
        "name, email, phone, source, status, notes, created_at, updated_at",
      )
      .eq("user_id", user!.id);
    const rows = data || [];
    const cols = [
      "name",
      "email",
      "phone",
      "source",
      "status",
      "notes",
      "created_at",
      "updated_at",
    ];
    const csv = [
      cols.join(","),
      ...rows.map((r) =>
        cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
      ),
    ].join("\n");
    downloadFile(
      `aromatool-contacte-${new Date().toISOString().slice(0, 10)}.csv`,
      "﻿" + csv, // BOM pentru diacritice în Excel
      "text/csv;charset=utf-8",
    );
    setExporting(false);
  }

  async function exportAccountJson() {
    setExporting(true);
    const [profileRes, contactsRes, offersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase.from("contacts").select("*").eq("user_id", user!.id),
      supabase.from("offers").select("*").eq("user_id", user!.id),
    ]);
    const bundle = {
      exported_at: new Date().toISOString(),
      account: { id: user!.id, email: user!.email },
      profile: profileRes.data ?? null,
      contacts: contactsRes.data ?? [],
      offers: offersRes.data ?? [],
    };
    downloadFile(
      `aromatool-date-cont-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle, null, 2),
      "application/json",
    );
    setExporting(false);
  }

  // ── Ștergere cont ──────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function deleteAccount() {
    setDeleteError("");
    setDeleting(true);
    const { data, error: fnErr } = await supabase.functions.invoke(
      "delete-account",
      { body: {} },
    );
    if (fnErr || data?.error) {
      setDeleting(false);
      setDeleteError(
        "Nu am putut șterge contul. Încearcă din nou sau scrie-ne.",
      );
      return;
    }
    // Cont șters — deconectăm și ieșim.
    await signOut();
  }

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, contact_email, email_signature, country_code, language_code, follow_up_days, daily_focus_enabled, daily_focus_hour, is_admin")
      .eq("id", user!.id)
      .single();

    if (data) {
      setProfile({
        full_name: data.full_name || user?.user_metadata?.full_name || "",
        phone: data.phone || "",
        contact_email: data.contact_email || user?.email || "",
        email_signature: data.email_signature || "",
        country_code: data.country_code || "RO",
        language_code: data.language_code || "ro",
        follow_up_days: data.follow_up_days || 5,
        daily_focus_enabled: data.daily_focus_enabled === true,
        daily_focus_hour: data.daily_focus_hour || 8,
        is_admin: data.is_admin === true,
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
        email_signature: profile.email_signature,
        country_code: profile.country_code,
        language_code: profile.language_code,
        follow_up_days: profile.follow_up_days,
        daily_focus_enabled: profile.daily_focus_enabled,
        daily_focus_hour: profile.daily_focus_hour,
        // Timezone-ul curent al browserului — folosit ca să trimitem la ora
        // locală aleasă, nu la ora serverului.
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Europe/Bucharest",
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
          email_signature: profile.email_signature,
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
            border: "3px solid #E8F0E8",
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
              <PhoneInput
                value={profile.phone}
                defaultCountry={profile.country_code}
                onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
                theme={{
                  border: "#EDE8E0",
                  inputBg: C.bg,
                  text: C.dark,
                  focus: C.primary,
                }}
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

          <div>
            <label style={labelStyle}>Semnătură email</label>
            <textarea
              value={profile.email_signature}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email_signature: e.target.value }))
              }
              rows={3}
              placeholder={"Cu drag,\nMaria Popescu\nDistribuitor independent Young Living"}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <div style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>
              Apare la finalul emailurilor trimise clienților (ofertă și
              follow-up). Lasă gol pentru mesajul standard.
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
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {flagOf(c.code)} {c.name}
                  </option>
                ))}
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

          <div>
            <label style={labelStyle}>Zile până la reminder follow-up</label>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input
                type="number"
                min={1}
                max={30}
                value={profile.follow_up_days}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    follow_up_days: parseInt(e.target.value) || 5,
                  }))
                }
                style={{ ...inputStyle, width: "80px" }}
              />
              <span
                style={{ fontSize: "12px", color: C.muted, lineHeight: 1.4 }}
              >
                zile — influențează când reapar contactele în Agenda din
                Dashboard, dacă nu au primit o ofertă în acest interval
              </span>
            </div>
          </div>

          {/* ── Daily Focus Email ──────────────────────────── */}
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: "18px",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: profile.daily_focus_enabled ? C.greenbg : C.bg2,
                borderRadius: "10px",
                border: `1px solid ${
                  profile.daily_focus_enabled
                    ? "rgba(46,138,88,0.2)"
                    : C.border
                }`,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: C.dark,
                  }}
                >
                  🌿 Daily Focus Email
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: C.muted,
                    marginTop: "2px",
                    lineHeight: 1.4,
                  }}
                >
                  În fiecare dimineață primești pe email contactele care merită
                  atenția ta azi. Dacă nu e nimic de făcut, nu primești nimic.
                </div>
              </div>
              <button
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    daily_focus_enabled: !p.daily_focus_enabled,
                  }))
                }
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "999px",
                  border: "none",
                  background: profile.daily_focus_enabled ? C.green : "#CCC",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: profile.daily_focus_enabled ? "25px" : "3px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>

            {profile.daily_focus_enabled && (
              <div style={{ marginTop: "12px" }}>
                <label style={labelStyle}>Ora trimiterii</label>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <select
                    value={profile.daily_focus_hour}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        daily_focus_hour: parseInt(e.target.value) || 8,
                      }))
                    }
                    style={{ ...inputStyle, width: "110px" }}
                  >
                    <option value={8}>08:00</option>
                    <option value={9}>09:00</option>
                    <option value={10}>10:00</option>
                  </select>
                  <span
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      lineHeight: 1.4,
                    }}
                  >
                    ora locală ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                  </span>
                </div>
              </div>
            )}
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
              : `linear-gradient(135deg, #5C7A5C, #4A6A4A)`,
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

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: `1px solid ${C.border}`,
            fontSize: "12px",
          }}
        >
          <Link to="/legal/terms" style={{ color: C.primary }}>
            Termeni
          </Link>
          <Link to="/legal/privacy" style={{ color: C.primary }}>
            Confidențialitate
          </Link>
          <Link to="/legal/cookies" style={{ color: C.primary }}>
            Cookie-uri
          </Link>
        </div>
      </div>

      {/* Date & export (GDPR) */}
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
            marginBottom: "6px",
          }}
        >
          📦 Datele tale
        </div>
        <div
          style={{
            fontSize: "12px",
            color: C.muted,
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          Descarcă o copie a datelor tale oricând.
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={exportContactsCsv}
            disabled={exporting}
            style={{
              flex: 1,
              minWidth: "180px",
              padding: "11px",
              background: C.bg,
              border: `1px solid ${C.border2}`,
              borderRadius: "10px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            ⬇️ Export contacte (CSV)
          </button>
          <button
            onClick={exportAccountJson}
            disabled={exporting}
            style={{
              flex: 1,
              minWidth: "180px",
              padding: "11px",
              background: C.bg,
              border: `1px solid ${C.border2}`,
              borderRadius: "10px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            ⬇️ Toate datele (JSON)
          </button>
        </div>
      </div>

      {/* Change password */}
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
          🔑 Schimbă parola
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Parolă nouă</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="Minim 6 caractere"
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirmă parola</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Repetă parola nouă"
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
        </div>

        {pwError && (
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
            ⚠️ {pwError}
          </div>
        )}

        {pwSuccess && (
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
            ✅ Parola a fost schimbată!
          </div>
        )}

        <button
          onClick={changePassword}
          disabled={pwSaving || !pw1 || !pw2}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "12px",
            background:
              pwSaving || !pw1 || !pw2
                ? C.muted
                : `linear-gradient(135deg, #5C7A5C, #4A6A4A)`,
            border: "none",
            borderRadius: "10px",
            color: "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            cursor: pwSaving || !pw1 || !pw2 ? "not-allowed" : "pointer",
          }}
        >
          {pwSaving ? "Se schimbă..." : "Schimbă parola"}
        </button>
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
            marginBottom: "20px",
          }}
        >
          🚪 Ieși din cont
        </button>

        {/* Ștergere definitivă cont */}
        <div
          style={{
            borderTop: `1px solid rgba(201,79,106,0.2)`,
            paddingTop: "18px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: C.dark }}>
            Șterge definitiv contul
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.muted,
              marginTop: "4px",
              lineHeight: 1.5,
              marginBottom: "12px",
            }}
          >
            Se șterg definitiv toate contactele, ofertele, resursele și datele
            tale. Acțiunea nu poate fi anulată. (Facturile se păstrează conform
            legii contabile.)
          </div>

          <label style={{ ...labelStyle, color: C.red }}>
            Scrie <strong>STERGE</strong> ca să confirmi
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="STERGE"
            style={{
              ...inputStyle,
              border: "1.5px solid rgba(201,79,106,0.35)",
            }}
          />

          {deleteError && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: C.red,
              }}
            >
              ⚠️ {deleteError}
            </div>
          )}

          <button
            onClick={() => {
              if (
                confirm(
                  "Ești absolut sigur? Toate datele tale vor fi șterse definitiv.",
                )
              )
                deleteAccount();
            }}
            disabled={deleteConfirm.trim() !== "STERGE" || deleting}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "12px",
              background:
                deleteConfirm.trim() === "STERGE" && !deleting
                  ? C.red
                  : "#E5D5DA",
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor:
                deleteConfirm.trim() === "STERGE" && !deleting
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {deleting ? "Se șterge contul..." : "🗑️ Șterge contul definitiv"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#6A5A50",
  marginBottom: "6px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#FAFAF7",
  border: "1.5px solid #EDE8E0",
  borderRadius: "10px",
  fontSize: "14px",
  color: "#3D3530",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
