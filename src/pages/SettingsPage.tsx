import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { setUiLang, type Lang } from "../i18n";
import { uiLocale } from "../lib/locale";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { COUNTRIES, flagOf } from "../lib/countries";
import PhoneInput from "../components/PhoneInput";
import {
  useSubscription,
  usePlanPrice,
  BillingToggle,
  PLAN,
} from "../lib/subscription";
import RedeemCodeForm from "../components/RedeemCodeForm";
import { useUpgrade } from "../hooks/useUpgrade";

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
  account_emails_opt_out: boolean;
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, signIn, signOut, updatePassword, updateEmail } = useAuth();

  // ── Abonament ──────────────────────────────────────────────
  const sub = useSubscription();
  // Preț live din Stripe (sursa de adevăr) — același hook ca în Paywall.
  const {
    priceLabel,
    monthlyLabel,
    annualLabel,
    annualPerMonthLabel,
    hasAnnual,
    annualSavePct,
  } = usePlanPrice();
  const [billing, setBilling] = useState<"month" | "year">("month");
  const { upgrade, loading: upgradeLoading, error: upgradeError } = useUpgrade();
  const [searchParams] = useSearchParams();
  const upgradeResult = searchParams.get("upgrade"); // "success" | "cancel"
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  // Detectare mobil — relaxăm DOAR grid-urile pe 2 coloane pe ecrane mici.
  // Desktopul rămâne identic.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // După întoarcerea din checkout reîmprospătăm starea abonamentului.
  useEffect(() => {
    if (upgradeResult === "success") sub.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradeResult]);

  async function openPortal() {
    setPortalError("");
    setPortalLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "customer-portal",
        { body: {} },
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }
      throw new Error(t("settings.subscription.portalNoLink"));
    } catch (e) {
      setPortalError(
        e instanceof Error ? e.message : t("settings.subscription.portalOpenError"),
      );
    } finally {
      setPortalLoading(false);
    }
  }
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
    account_emails_opt_out: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Probă Daily Focus — trimite imediat o rulare de test pe propriul cont.
  const [focusTesting, setFocusTesting] = useState(false);
  const [focusTestMsg, setFocusTestMsg] = useState("");
  const [focusTestErr, setFocusTestErr] = useState("");

  // Re-abonare la emailurile despre cont — apare DOAR dacă userul s-a
  // dezabonat (din linkul din email). Acțiune separată de „Salvează".
  const [reactivating, setReactivating] = useState(false);
  const [reactivated, setReactivated] = useState(false);

  async function reactivateAccountEmails() {
    setReactivating(true);
    const { error: reErr } = await supabase
      .from("profiles")
      .update({
        account_emails_opt_out: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user!.id);
    setReactivating(false);
    if (!reErr) {
      setProfile((p) => ({ ...p, account_emails_opt_out: false }));
      setReactivated(true);
      setTimeout(() => setReactivated(false), 5000);
    }
  }

  async function testDailyFocus() {
    setFocusTesting(true);
    setFocusTestMsg("");
    setFocusTestErr("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("daily-focus");
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (data?.sent > 0) {
        setFocusTestMsg(t("settings.focus.testSent"));
      } else if (data?.failed > 0) {
        const detail = data?.errors?.[0]?.error;
        setFocusTestErr(
          detail
            ? t("settings.focus.testFailedDetail", { detail })
            : t("settings.focus.testFailed")
        );
      } else {
        setFocusTestMsg(t("settings.focus.testNoContacts"));
      }
    } catch (e) {
      setFocusTestErr(
        e instanceof Error ? e.message : t("settings.focus.testError")
      );
    } finally {
      setFocusTesting(false);
    }
  }

  // Schimbare parolă
  const [pwCurrent, setPwCurrent] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function changePassword() {
    setPwError("");
    setPwSuccess(false);
    if (pw1.length < 6) {
      setPwError(t("settings.password.tooShort"));
      return;
    }
    if (pw1 !== pw2) {
      setPwError(t("settings.password.mismatch"));
      return;
    }
    setPwSaving(true);
    // Securitate: verificăm parola CURENTĂ înainte de schimbare, ca o sesiune
    // deschisă (device partajat) să nu poată prelua contul fără s-o știe.
    // signIn = signInWithPassword pe același user → doar reîmprospătează
    // sesiunea, nu deloghează.
    const { error: reauthErr } = await signIn(user!.email!, pwCurrent);
    if (reauthErr) {
      setPwSaving(false);
      setPwError(t("settings.password.wrongCurrent"));
      return;
    }
    const { error: pwErr } = await updatePassword(pw1);
    setPwSaving(false);
    if (pwErr) {
      setPwError(t("settings.password.changeError"));
    } else {
      setPwCurrent("");
      setPw1("");
      setPw2("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    }
  }

  // Schimbare email
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);

  async function changeEmail() {
    setEmailError("");
    setEmailSuccess(false);
    const val = newEmail.trim();
    // Validare minimală (Supabase revalidează oricum pe server).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setEmailError(t("settings.email.invalid"));
      return;
    }
    if (val.toLowerCase() === (user?.email || "").toLowerCase()) {
      setEmailError(t("settings.email.same"));
      return;
    }
    setEmailSaving(true);
    const { error: emErr } = await updateEmail(val);
    setEmailSaving(false);
    if (emErr) {
      setEmailError(t("settings.email.changeError"));
    } else {
      setNewEmail("");
      setEmailSuccess(true);
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
    // Export GDPR complet: toate datele personale legate de cont, nu doar
    // profil/contacte/oferte. Includem și resursele, șabloanele PROPRII (nu
    // cele de sistem cu user_id NULL), jurnalul de follow-up și logul de
    // emailuri trimise — adică tot ce ține de activitatea utilizatorului.
    const [
      profileRes,
      contactsRes,
      offersRes,
      resourcesRes,
      templatesRes,
      followupLogRes,
      emailLogRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase.from("contacts").select("*").eq("user_id", user!.id),
      supabase.from("offers").select("*").eq("user_id", user!.id),
      supabase.from("resources").select("*").eq("user_id", user!.id),
      supabase.from("followup_templates").select("*").eq("user_id", user!.id),
      supabase.from("followup_log").select("*").eq("user_id", user!.id),
      supabase.from("email_send_log").select("*").eq("user_id", user!.id),
    ]);
    const bundle = {
      exported_at: new Date().toISOString(),
      account: { id: user!.id, email: user!.email },
      profile: profileRes.data ?? null,
      contacts: contactsRes.data ?? [],
      offers: offersRes.data ?? [],
      resources: resourcesRes.data ?? [],
      followup_templates: templatesRes.data ?? [],
      followup_log: followupLogRes.data ?? [],
      email_send_log: emailLogRes.data ?? [],
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
      setDeleteError(t("settings.danger.deleteError"));
      return;
    }
    // Cont șters — deconectăm și ieșim.
    await signOut();
  }

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  // Dacă s-a navigat aici cu #subscription (din banner-ul de trial al altei
  // pagini), derulăm la cardul Abonament după ce conținutul s-a montat.
  useEffect(() => {
    if (loading) return;
    if (window.location.hash !== "#subscription") return;
    const id = requestAnimationFrame(() => {
      document
        .getElementById("subscription-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [loading]);

  async function loadProfile() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, contact_email, email_signature, country_code, language_code, follow_up_days, daily_focus_enabled, daily_focus_hour, is_admin, account_emails_opt_out")
      .eq("id", user!.id)
      .single();

    if (data) {
      // UI-ul suportă doar ro/en; valori vechi (de/fr) cad pe 'ro'.
      const langCode =
        data.language_code === "en" ? "en" : "ro";
      setProfile({
        full_name: data.full_name || user?.user_metadata?.full_name || "",
        phone: data.phone || "",
        contact_email: data.contact_email || user?.email || "",
        email_signature: data.email_signature || "",
        country_code: data.country_code || "RO",
        language_code: langCode,
        follow_up_days: data.follow_up_days || 5,
        daily_focus_enabled: data.daily_focus_enabled === true,
        daily_focus_hour: data.daily_focus_hour || 8,
        is_admin: data.is_admin === true,
        account_emails_opt_out: data.account_emails_opt_out === true,
      });
      // Sincronizează limba interfeței cu preferința din profil (sursa
      // de adevăr între dispozitive).
      setUiLang(langCode as Lang);
    }
    setLoading(false);
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setSuccess(false);

    // Email-ul de contact e opțional, dar dacă e completat devine reply-to în
    // emailurile către clienți → un format invalid ar rupe răspunsurile. Validăm
    // doar când e completat (gol = folosim emailul de login ca fallback).
    const contactEmail = (profile.contact_email || "").trim();
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError(t("settings.invalidEmail"));
      setSaving(false);
      return;
    }

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
      setError(t("settings.saveError"));
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
    <div className="set-page" style={{ maxWidth: "560px", margin: "0 auto" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          /* font 16px pe mobil = previne auto-zoom-ul iOS la focus pe câmp */
          .set-page input, .set-page textarea, .set-page select { font-size: 16px !important; }
        }
      `}</style>

      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "22px",
          color: C.dark,
          marginBottom: "24px",
        }}
      >
        {t("settings.title")}
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
          {t("settings.profile.heading")}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>{t("settings.profile.nameLabel")}</label>
            <input
              value={profile.full_name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, full_name: e.target.value }))
              }
              placeholder={t("settings.profile.namePlaceholder")}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>{t("settings.profile.phoneLabel")}</label>
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
                {t("settings.profile.appearsInEmails")}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t("settings.profile.emailLabel")}</label>
              <input
                value={profile.contact_email}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, contact_email: e.target.value }))
                }
                placeholder={t("settings.profile.emailPlaceholder")}
                style={inputStyle}
              />
              <div
                style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}
              >
                {t("settings.profile.appearsInEmails")}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t("settings.profile.signatureLabel")}</label>
            <textarea
              value={profile.email_signature}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email_signature: e.target.value }))
              }
              rows={3}
              placeholder={t("settings.profile.signaturePlaceholder")}
              style={{
                ...inputStyle,
                resize: "vertical",
                lineHeight: 1.6,
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <div style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>
              {t("settings.profile.signatureHint")}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "12px",
            }}
          >
            <div>
              <label style={labelStyle}>{t("settings.profile.countryLabel")}</label>
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
              <label style={labelStyle}>{t("common.language")}</label>
              <select
                value={profile.language_code}
                onChange={(e) => {
                  const lng = e.target.value as Lang;
                  setProfile((p) => ({ ...p, language_code: lng }));
                  // Schimbă imediat limba interfeței (+ persistă local).
                  setUiLang(lng);
                }}
                style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
              >
                <option value="ro">🇷🇴 {t("common.romanian")}</option>
                <option value="en">🇬🇧 {t("common.english")}</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t("settings.profile.followupDaysLabel")}</label>
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
                {t("settings.profile.followupDaysHint")}
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
                  {t("settings.focus.title")}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: C.muted,
                    marginTop: "2px",
                    lineHeight: 1.4,
                  }}
                >
                  {t("settings.focus.desc")}
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
                <label style={labelStyle}>{t("settings.focus.hourLabel")}</label>
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
                    {t("settings.focus.localTime", { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                  </span>
                </div>

                {/* Probă — trimite acum o rulare de test pe propriul cont */}
                <div style={{ marginTop: "14px" }}>
                  <button
                    type="button"
                    onClick={testDailyFocus}
                    disabled={focusTesting}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "9px 16px",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      fontWeight: 500,
                      background: focusTesting ? C.bg2 : C.green,
                      color: focusTesting ? C.muted : "#fff",
                      border: "none",
                      borderRadius: "10px",
                      cursor: focusTesting ? "default" : "pointer",
                    }}
                  >
                    <i className="ti ti-send" style={{ fontSize: "15px" }} />
                    {focusTesting ? t("settings.focus.sending") : t("settings.focus.sendTest")}
                  </button>
                  <div
                    style={{
                      fontSize: "11px",
                      color: C.muted,
                      marginTop: "6px",
                      lineHeight: 1.4,
                    }}
                  >
                    {t("settings.focus.testHint")}
                  </div>
                  {focusTestMsg && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: C.green,
                        lineHeight: 1.4,
                      }}
                    >
                      ✓ {focusTestMsg}
                    </div>
                  )}
                  {focusTestErr && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: C.red,
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠️ {focusTestErr}
                    </div>
                  )}
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
            ✅ {t("settings.savedSuccess")}
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
          {saving ? t("settings.saving") : t("settings.saveChanges")}
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
          {t("settings.account.heading")}
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
          <span style={{ fontSize: "13px", color: C.muted }}>{t("settings.account.emailLogin")}</span>
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
          }}
        >
          <span style={{ fontSize: "13px", color: C.muted }}>{t("settings.account.created")}</span>
          <span style={{ fontSize: "13px", color: C.dark }}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString(uiLocale(i18n.language))
              : "—"}
          </span>
        </div>

        {/* Re-abonare — vizibilă DOAR dacă userul s-a dezabonat din email. */}
        {(profile.account_emails_opt_out || reactivated) && (
          <div
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: `1px solid ${C.border}`,
            }}
          >
            {profile.account_emails_opt_out ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  background: C.bg2,
                  borderRadius: "10px",
                  padding: "12px 14px",
                }}
              >
                <span style={{ fontSize: "13px", color: C.muted, lineHeight: 1.5 }}>
                  {t("settings.account.emailsOptedOut")}
                </span>
                <button
                  onClick={reactivateAccountEmails}
                  disabled={reactivating}
                  style={{
                    background: C.green,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: reactivating ? "default" : "pointer",
                    whiteSpace: "nowrap",
                    opacity: reactivating ? 0.6 : 1,
                  }}
                >
                  {reactivating
                    ? t("settings.account.reactivating")
                    : t("settings.account.reactivate")}
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: C.greenbg,
                  borderRadius: "10px",
                  padding: "12px 14px",
                  fontSize: "13px",
                  color: C.green,
                  fontWeight: 500,
                }}
              >
                {t("settings.account.reactivated")}
              </div>
            )}
          </div>
        )}

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
            {t("settings.account.terms")}
          </Link>
          <Link to="/legal/privacy" style={{ color: C.primary }}>
            {t("settings.account.privacy")}
          </Link>
          <Link to="/legal/cookies" style={{ color: C.primary }}>
            {t("settings.account.cookies")}
          </Link>
        </div>
      </div>

      {/* Abonament / Plan */}
      <div
        id="subscription-card"
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
          {t("settings.subscription.heading")}
        </div>

        {upgradeResult === "success" && (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.green,
            }}
          >
            ✅ {t("settings.subscription.thanksActive")}
          </div>
        )}

        {/* Status curent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "14px 16px",
            background: C.bg,
            border: `1px solid ${C.border2}`,
            borderRadius: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: C.dark }}>
              {sub.isAdmin
                ? t("settings.subscription.adminAccount")
                : sub.freeAccess
                  ? t("settings.subscription.freeAccess")
                  : sub.isActive
                    ? PLAN.name
                    : sub.isTrialing
                      ? t("settings.subscription.trial")
                      : t("settings.subscription.none")}
            </div>
            <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
              {sub.isAdmin
                ? t("settings.subscription.adminDesc")
                : sub.freeAccess
                  ? t("settings.subscription.freeDesc")
                  : sub.isActive
                    ? t("settings.subscription.activeDesc")
                    : sub.isPastDue
                      ? t("settings.subscription.pastDue")
                      : sub.isTrialing
                        ? sub.daysLeft === 1
                          ? t("settings.subscription.expiresTomorrow")
                          : t("settings.subscription.daysLeft", { days: sub.daysLeft })
                        : t("settings.subscription.trialEnded")}
            </div>
            {sub.isActive && sub.renewsAt && (
              <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
                {t(
                  sub.cancelAtPeriodEnd
                    ? "settings.subscription.activeUntil"
                    : "settings.subscription.renewsOn",
                  {
                    date: sub.renewsAt.toLocaleDateString(i18n.language, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  },
                )}
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "999px",
              background: sub.hasAccess ? C.greenbg : C.redbg,
              color: sub.hasAccess ? C.green : C.red,
              whiteSpace: "nowrap",
            }}
          >
            {sub.hasAccess ? t("settings.subscription.accessActive") : t("settings.subscription.accessBlocked")}
          </span>
        </div>

        {(portalError || upgradeError) && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 14px",
              background: C.redbg,
              border: `1px solid rgba(201,79,106,0.2)`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.red,
            }}
          >
            ⚠️ {portalError || upgradeError}
          </div>
        )}

        {/* Acțiuni — adminii și conturile cu acces gratuit nu plătesc. */}
        {sub.isAdmin || sub.freeAccess ? null : sub.isActive ||
          sub.isPastDue ? (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            style={{
              width: "100%",
              padding: "12px",
              background: C.bg,
              border: `1px solid ${C.border2}`,
              borderRadius: "10px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              cursor: portalLoading ? "not-allowed" : "pointer",
            }}
          >
            {portalLoading ? t("settings.subscription.opening") : t("settings.subscription.manage")}
          </button>
        ) : (
          <>
            {hasAnnual && (
              <BillingToggle
                value={billing}
                onChange={setBilling}
                monthlyText={t("paywall.billingMonthly")}
                annualText={t("paywall.billingAnnual")}
                savePct={annualSavePct}
              />
            )}
            <div
              style={{
                fontSize: "13px",
                color: C.muted,
                marginBottom: "12px",
                lineHeight: 1.5,
              }}
            >
              {PLAN.name} —{" "}
              <strong style={{ color: C.dark }}>
                {(billing === "year" ? annualLabel : monthlyLabel) ??
                  priceLabel ??
                  PLAN.priceText}
              </strong>
              {billing === "year" && annualPerMonthLabel
                ? ` (${t("paywall.annualEquiv", { price: annualPerMonthLabel })})`
                : ""}
              . {PLAN.tagline}
            </div>
            <button
              onClick={() => upgrade(PLAN.id, billing)}
              disabled={upgradeLoading}
              style={{
                width: "100%",
                padding: "12px",
                background: upgradeLoading
                  ? C.muted
                  : `linear-gradient(135deg, #5C7A5C, #4A6A4A)`,
                border: "none",
                borderRadius: "10px",
                color: "white",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                cursor: upgradeLoading ? "not-allowed" : "pointer",
              }}
            >
              {upgradeLoading ? t("settings.subscription.opening") : t("settings.subscription.subscribe")}
            </button>
          </>
        )}

        {/* Introdu cod — zile gratuite (nu pentru admin / acces gratuit) */}
        {!sub.isAdmin && !sub.freeAccess && (
          <div
            style={{
              marginTop: "18px",
              paddingTop: "18px",
              borderTop: `1px solid ${C.border2}`,
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: C.dark,
                marginBottom: "4px",
              }}
            >
              {t("promo.redeem.title")}
            </div>
            <div
              style={{ fontSize: "12px", color: C.muted, marginBottom: "10px" }}
            >
              {t("promo.redeem.hint")}
            </div>
            <RedeemCodeForm />
          </div>
        )}
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
          {t("settings.data.heading")}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: C.muted,
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          {t("settings.data.desc")}
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
            {t("settings.data.exportCsv")}
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
            {t("settings.data.exportJson")}
          </button>
        </div>
      </div>

      {/* Change email */}
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
          {t("settings.email.heading")}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>{t("settings.email.currentLabel")}</label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              style={{ ...inputStyle, background: C.bg2, color: C.muted, cursor: "not-allowed" }}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("settings.email.newLabel")}</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("settings.email.newPlaceholder")}
              autoComplete="email"
              style={inputStyle}
            />
          </div>
        </div>

        {emailError && (
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
            ⚠️ {emailError}
          </div>
        )}

        {emailSuccess && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.green,
              lineHeight: 1.5,
            }}
          >
            ✅ {t("settings.email.sent")}
          </div>
        )}

        <button
          onClick={changeEmail}
          disabled={emailSaving || !newEmail}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "12px",
            background:
              emailSaving || !newEmail
                ? C.border
                : `linear-gradient(135deg, #5C7A5C, #4A6A4A)`,
            border: "none",
            borderRadius: "10px",
            color: emailSaving || !newEmail ? C.muted : "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            cursor: emailSaving || !newEmail ? "not-allowed" : "pointer",
          }}
        >
          {emailSaving ? t("settings.email.changing") : t("settings.email.submit")}
        </button>
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
          {t("settings.password.heading")}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div>
            <label style={labelStyle}>{t("settings.password.currentLabel")}</label>
            <input
              type="password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              placeholder={t("settings.password.currentPlaceholder")}
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("settings.password.newLabel")}</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder={t("settings.password.newPlaceholder")}
              autoComplete="new-password"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("settings.password.confirmLabel")}</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder={t("settings.password.confirmPlaceholder")}
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
            ✅ {t("settings.password.changed")}
          </div>
        )}

        <button
          onClick={changePassword}
          disabled={pwSaving || !pwCurrent || !pw1 || !pw2}
          style={{
            marginTop: "16px",
            width: "100%",
            padding: "12px",
            background:
              pwSaving || !pwCurrent || !pw1 || !pw2
                ? C.border
                : `linear-gradient(135deg, #5C7A5C, #4A6A4A)`,
            border: "none",
            borderRadius: "10px",
            color: pwSaving || !pwCurrent || !pw1 || !pw2 ? C.muted : "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            cursor: pwSaving || !pwCurrent || !pw1 || !pw2 ? "not-allowed" : "pointer",
          }}
        >
          {pwSaving ? t("settings.password.changing") : t("settings.password.submit")}
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
          {t("settings.danger.heading")}
        </div>
        <button
          onClick={() => {
            if (confirm(t("settings.danger.signOutConfirm"))) signOut();
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
          {t("settings.danger.signOut")}
        </button>

        {/* Ștergere definitivă cont */}
        <div
          style={{
            borderTop: `1px solid rgba(201,79,106,0.2)`,
            paddingTop: "18px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: C.dark }}>
            {t("settings.danger.deleteTitle")}
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
            {t("settings.danger.deleteDesc")}
          </div>

          <label style={{ ...labelStyle, color: C.red }}>
            {t("settings.danger.deleteConfirmPre")}{" "}
            <strong>{t("settings.danger.deleteKeyword")}</strong>{" "}
            {t("settings.danger.deleteConfirmPost")}
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={t("settings.danger.deleteKeyword")}
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
                confirm(t("settings.danger.deleteFinalConfirm"))
              )
                deleteAccount();
            }}
            disabled={deleteConfirm.trim() !== t("settings.danger.deleteKeyword") || deleting}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "12px",
              background:
                deleteConfirm.trim() === t("settings.danger.deleteKeyword") && !deleting
                  ? C.red
                  : "#E5D5DA",
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor:
                deleteConfirm.trim() === t("settings.danger.deleteKeyword") && !deleting
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {deleting ? t("settings.danger.deleting") : t("settings.danger.deleteBtn")}
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
