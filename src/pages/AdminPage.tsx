import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import i18n from "../i18n";
import { uiLocale } from "../lib/locale";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

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
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
};

// Țările cu catalog suportat (= cheile CULTURE_BY_COUNTRY din edge function).
// Folosite de butonul „Importă toate" pentru a rula importul secvențial.
const IMPORT_COUNTRIES = [
  "RO", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI", "GB", "MD", "UA",
];

// Steag + cod scurt pentru tabelul de status pe țară.
const COUNTRY_FLAGS: Record<string, string> = {
  RO: "🇷🇴", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", BE: "🇧🇪",
  AT: "🇦🇹", IE: "🇮🇪", PT: "🇵🇹", FI: "🇫🇮", GB: "🇬🇧", MD: "🇲🇩", UA: "🇺🇦",
};

interface Overview {
  total_users: number;
  total_contacts: number;
  total_offers: number;
  new_feedback: number;
  active_7d: number;
  emails_today: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  free_access: boolean;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  contacts_count: number;
  offers_count: number;
}

interface FeedbackRow {
  id: string;
  user_id: string | null;
  type: string;
  message: string;
  page: string | null;
  user_email: string | null;
  status: string;
  created_at: string;
}

interface ImportJob {
  status: string;
  records_total: number | null;
  records_imported: number | null;
  records_failed: number | null;
  created_at: string;
  completed_at: string | null;
}

interface CountryJob {
  country_code: string;
  status: string;
  records_total: number | null;
  records_imported: number | null;
  records_failed: number | null;
  records_new: number | null;
  records_updated: number | null;
  records_deactivated: number | null;
  created_at: string;
  completed_at: string | null;
}

interface FocusJob {
  id: string;
  run_at: string;
  trigger: string;
  users_processed: number;
  emails_sent: number;
  emails_failed: number;
  errors: { user_id: string; error: string }[];
  completed_at: string | null;
}

interface FailedImport {
  id: string;
  status: string;
  records_failed: number | null;
  error_log: unknown;
  created_at: string;
}

// Eveniment unificat pentru Error Center.
interface ErrorEvent {
  id: string;
  service: string;
  icon: string;
  message: string;
  at: string;
}

// Cod promoțional (extindere trial). Oglindește tabelul promo_codes.
interface PromoCode {
  id: string;
  code: string;
  kind: string;
  trial_days: number;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

// Consum email prin aplicație (RPC admin_email_usage). Sursele: offers + account_email_log.
interface EmailUsage {
  month_offers: number;
  month_account: number;
  month_total: number;
  day_offers: number;
  day_account: number;
  day_total: number;
}

// Plafoanele planului Resend (free tier). Folosite doar pentru a desena
// bara de progres; nu sunt o limită impusă de noi.
const RESEND_MONTH_LIMIT = 3000;
const RESEND_DAY_LIMIT = 100;

type Tab = "users" | "feedback" | "focus" | "catalog" | "codes" | "errors";

// Statusuri feedback (operare: triaj simplu). Eticheta vine din i18n
// (admin.feedbackStatus.<key>); aici păstrăm doar culorile.
const FEEDBACK_STATUS: Record<string, { bg: string; color: string }> = {
  new: { bg: "#FFF0F4", color: "#C94F6A" },
  reviewed: { bg: "#E8F0E8", color: "#4A6A4A" },
  planned: { bg: "#F0EEF8", color: "#9888B8" },
  done: { bg: "#E8F8F0", color: "#2E8A58" },
};
const STATUS_ORDER = ["new", "reviewed", "planned", "done"];

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  team: "Team",
  business: "Business",
};

// Eticheta vine din i18n (admin.feedbackType.<key>); aici doar iconul.
const FEEDBACK_TYPE: Record<string, { icon: string }> = {
  sugestie: { icon: "ti-bulb" },
  problema: { icon: "ti-alert-triangle" },
  altele: { icon: "ti-message" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(uiLocale(i18n.language), {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(uiLocale(i18n.language), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// „Ultim login" relativ, scurt (azi / acum 3 zile / dd mmm).
function fmtLastSeen(iso: string | null, t: TFunction): string {
  if (!iso) return t("admin.neverLoggedIn");
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const now = new Date();
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
  if (days <= 0) return t("admin.today");
  if (days === 1) return t("admin.yesterday");
  if (days < 7) return t("admin.daysAgo", { n: days });
  return fmtDate(iso);
}

// Stare trial scurtă pentru tabelul de utilizatori.
function trialLabel(
  iso: string | null,
  t: TFunction,
): { text: string; expired: boolean } {
  if (!iso) return { text: "—", expired: false };
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return { text: "—", expired: false };
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) return { text: t("admin.trialExpired"), expired: true };
  if (days === 1) return { text: t("admin.trialOneDay"), expired: false };
  return { text: t("admin.trialDays", { n: days }), expired: false };
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("users");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // ── Config trial (global) ────────────────────────────────
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [trialInput, setTrialInput] = useState("");
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialMsg, setTrialMsg] = useState("");

  // ── Catalog produse ──────────────────────────────────────
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const [countryJobs, setCountryJobs] = useState<Record<string, CountryJob>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncProgress, setSyncProgress] = useState("");
  const [importCountry, setImportCountry] = useState("RO");

  // ── Daily Focus ──────────────────────────────────────────
  const [focusJobs, setFocusJobs] = useState<FocusJob[]>([]);
  const [focusTesting, setFocusTesting] = useState(false);
  const [focusTestMsg, setFocusTestMsg] = useState("");
  const [focusTestErr, setFocusTestErr] = useState("");

  // ── Consum email (Resend) ────────────────────────────────
  const [emailUsage, setEmailUsage] = useState<EmailUsage | null>(null);
  const [emailUsageErr, setEmailUsageErr] = useState("");

  // ── Error Center ─────────────────────────────────────────
  const [failedImports, setFailedImports] = useState<FailedImport[]>([]);

  // ── Coduri promoționale ──────────────────────────────────
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoErr, setPromoErr] = useState("");
  // Creare cod unic
  const [pcCode, setPcCode] = useState("");
  const [pcDays, setPcDays] = useState("15");
  const [pcMax, setPcMax] = useState("1");
  const [pcExpires, setPcExpires] = useState("");
  const [pcNote, setPcNote] = useState("");
  const [pcCreating, setPcCreating] = useState(false);

  // ── Guard: doar adminii ──────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!active) return;
        const ok = !!data?.is_admin;
        setAuthorized(ok);
        if (!ok) {
          setTimeout(() => navigate("/app/dashboard"), 1500);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id, navigate]);

  // ── Date admin ───────────────────────────────────────────
  useEffect(() => {
    if (authorized !== true) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      const [ov, us, fb, job, focus, failed, td] = await Promise.all([
        supabase.rpc("admin_overview"),
        supabase.rpc("admin_users"),
        supabase
          .from("feedback")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("product_import_jobs")
          .select(
            "status, records_total, records_imported, records_failed, created_at, completed_at"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("daily_focus_jobs")
          .select("*")
          .order("run_at", { ascending: false })
          .limit(20),
        supabase
          .from("product_import_jobs")
          .select("id, status, records_failed, error_log, created_at")
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.rpc("admin_get_trial_days"),
      ]);
      if (!active) return;
      if (ov.error || us.error || fb.error) {
        setError(t("admin.loadError"));
      } else {
        setOverview(ov.data as Overview);
        setUsers((us.data as AdminUser[]) ?? []);
        setFeedback((fb.data as FeedbackRow[]) ?? []);
        if (job.data) setLastJob(job.data as ImportJob);
        setFocusJobs((focus.data as FocusJob[]) ?? []);
        setFailedImports((failed.data as FailedImport[]) ?? []);
        if (typeof td.data === "number") {
          setTrialDays(td.data);
          setTrialInput(String(td.data));
        }
        await loadCountryJobs();
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorized]);

  // Încarcă codurile prima dată când se deschide tabul „Coduri".
  useEffect(() => {
    if (authorized !== true || tab !== "codes") return;
    if (promoCodes.length > 0 || promoLoading) return;
    loadPromoCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, tab]);

  // Încarcă consumul de email prima dată când se deschide tabul „Daily Focus".
  useEffect(() => {
    if (authorized !== true || tab !== "focus") return;
    if (emailUsage || emailUsageErr) return;
    loadEmailUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, tab]);

  async function loadEmailUsage() {
    const { data, error } = await supabase.rpc("admin_email_usage");
    if (error || !data) {
      setEmailUsageErr(t("admin.emailUsageError"));
      return;
    }
    setEmailUsage(data as EmailUsage);
  }

  async function loadLastJob() {
    const { data } = await supabase
      .from("product_import_jobs")
      .select(
        "status, records_total, records_imported, records_failed, created_at, completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setLastJob(data as ImportJob);
    await loadCountryJobs();
  }

  // Ultimul job per țară (manual sau cron). Luăm ultimele 200 rânduri ordonate
  // descrescător și păstrăm prima apariție = cea mai recentă pentru fiecare țară.
  async function loadCountryJobs() {
    const { data } = await supabase
      .from("product_import_jobs")
      .select(
        "country_code, status, records_total, records_imported, records_failed, records_new, records_updated, records_deactivated, created_at, completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return;
    const latest: Record<string, CountryJob> = {};
    for (const row of data as CountryJob[]) {
      if (row.country_code && !latest[row.country_code]) latest[row.country_code] = row;
    }
    setCountryJobs(latest);
  }

  // ── Coduri promoționale ──────────────────────────────────
  async function loadPromoCodes() {
    setPromoLoading(true);
    setPromoErr("");
    const { data, error } = await supabase.rpc("admin_list_promo_codes");
    if (error) setPromoErr(t("promo.admin.createError"));
    else setPromoCodes((data as PromoCode[]) ?? []);
    setPromoLoading(false);
  }

  async function createPromoCode() {
    const days = parseInt(pcDays, 10);
    if (!days || days <= 0 || pcCreating) return;
    setPcCreating(true);
    setPromoErr("");
    const maxTrim = pcMax.trim();
    const { error } = await supabase.rpc("admin_create_promo_code", {
      p_code: pcCode.trim() || null,
      p_trial_days: days,
      p_max_redemptions: maxTrim === "" ? null : parseInt(maxTrim, 10),
      p_expires_at: pcExpires ? new Date(pcExpires).toISOString() : null,
      p_note: pcNote.trim() || null,
    });
    setPcCreating(false);
    if (error) {
      setPromoErr(error.message || t("promo.admin.createError"));
      return;
    }
    setPcCode("");
    setPcNote("");
    setPcExpires("");
    await loadPromoCodes();
  }

  async function togglePromoActive(pc: PromoCode) {
    setPromoErr("");
    const { error } = await supabase.rpc("admin_set_promo_code_active", {
      p_id: pc.id,
      p_value: !pc.active,
    });
    if (error) {
      setPromoErr(t("promo.admin.createError"));
      return;
    }
    setPromoCodes((prev) =>
      prev.map((c) => (c.id === pc.id ? { ...c, active: !c.active } : c)),
    );
  }

  // Transformă o eroare de la `functions.invoke` într-un mesaj lizibil:
  // 401/403 = sesiune expirată (cel mai frecvent), altfel încearcă să
  // citească {error} din corpul răspunsului, altfel mesajul generic.
  async function explainSyncError(fnError: unknown): Promise<string> {
    const ctx = (fnError as { context?: Response })?.context;
    const status = ctx?.status;
    if (status === 401 || status === 403) return t("admin.sessionExpired");
    try {
      const body = await ctx?.clone().json();
      if (body?.error) return body.error as string;
    } catch {
      // corp ne-JSON / lipsă → cădem pe mesajul de mai jos
    }
    return fnError instanceof Error ? fnError.message : t("admin.syncFailed");
  }

  async function syncProducts() {
    setSyncing(true);
    setSyncError("");
    setSyncResult("");
    try {
      const { data, error: fnError } =
        await supabase.functions.invoke("import-products", {
          body: { country: importCountry },
        });
      if (fnError) throw new Error(await explainSyncError(fnError));
      if (data?.error) throw new Error(data.error);
      setSyncResult(
        t("admin.syncResult", { n: data.imported }) +
          (data.deactivated
            ? t("admin.syncResultDeactivated", { n: data.deactivated })
            : "") +
          (data.skipped
            ? t("admin.syncResultSkipped", { n: data.skipped })
            : "")
      );
      await loadLastJob();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : t("admin.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }

  // Importă TOATE cataloagele, secvențial (un apel per țară). Secvențial =
  // fără timeout pe o singură invocare și progres clar; o țară eșuată nu
  // oprește restul (le colectăm și le raportăm la final).
  async function syncAllProducts() {
    setSyncing(true);
    setSyncError("");
    setSyncResult("");
    let totalImported = 0;
    const failed: string[] = [];
    for (let i = 0; i < IMPORT_COUNTRIES.length; i++) {
      const c = IMPORT_COUNTRIES[i];
      setSyncProgress(
        t("admin.syncProgress", { country: c, i: i + 1, n: IMPORT_COUNTRIES.length })
      );
      try {
        const { data, error: fnError } =
          await supabase.functions.invoke("import-products", {
            body: { country: c },
          });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        totalImported += data?.imported ?? 0;
      } catch (e) {
        // Sesiune expirată (401/403): nu are sens să continuăm restul —
        // toate ar eșua la fel. Oprim și afișăm mesajul de relogare.
        const status = (e as { context?: Response })?.context?.status;
        if (status === 401 || status === 403) {
          setSyncProgress("");
          setSyncError(t("admin.sessionExpired"));
          setSyncing(false);
          return;
        }
        failed.push(c);
      }
    }
    setSyncProgress("");
    setSyncResult(
      t("admin.syncAllResult", {
        imported: totalImported,
        ok: IMPORT_COUNTRIES.length - failed.length,
        total: IMPORT_COUNTRIES.length,
      }) + (failed.length ? " " + t("admin.syncAllFailed", { list: failed.join(", ") }) : "")
    );
    await loadLastJob();
    setSyncing(false);
  }

  async function testDailyFocus() {
    setFocusTesting(true);
    setFocusTestErr("");
    setFocusTestMsg("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("daily-focus");
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setFocusTestMsg(
        data.sent > 0
          ? t("admin.focusSent", { sent: data.sent, processed: data.processed })
          : t("admin.focusEmptyRun")
      );
      // Reîncarcă jobs ca să apară rularea de test.
      const { data: fresh } = await supabase
        .from("daily_focus_jobs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      setFocusJobs((fresh as FocusJob[]) ?? []);
    } catch (e) {
      setFocusTestErr(e instanceof Error ? e.message : t("admin.focusRunFailed"));
    } finally {
      setFocusTesting(false);
    }
  }

  const [busyUser, setBusyUser] = useState<string | null>(null);

  async function toggleAdmin(target: AdminUser) {
    const makeAdmin = !target.is_admin;
    const name = target.full_name || target.email;
    const msg = makeAdmin
      ? t("admin.confirmGrantAdmin", { name })
      : t("admin.confirmRevokeAdmin", { name });
    if (!confirm(msg)) return;
    setBusyUser(target.id);
    const { error: rpcErr } = await supabase.rpc("admin_set_user_admin", {
      target_id: target.id,
      make_admin: makeAdmin,
    });
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || t("admin.roleUpdateError"));
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, is_admin: makeAdmin } : u))
    );
  }

  // Salvează durata globală de trial (pentru conturi noi).
  async function saveTrialDays() {
    const n = parseInt(trialInput, 10);
    if (Number.isNaN(n) || n < 0 || n > 365) {
      setTrialMsg(t("admin.trialInputRange"));
      return;
    }
    setTrialSaving(true);
    setTrialMsg("");
    const { data, error: rpcErr } = await supabase.rpc("admin_set_trial_days", {
      p_days: n,
    });
    setTrialSaving(false);
    if (rpcErr) {
      setTrialMsg(rpcErr.message || t("admin.trialSaveError"));
      return;
    }
    const saved = typeof data === "number" ? data : n;
    setTrialDays(saved);
    setTrialInput(String(saved));
    setTrialMsg(t("admin.trialSaved", { n: saved }));
    setTimeout(() => setTrialMsg(""), 3000);
  }

  // Setează trialul unui utilizator la „azi + X zile".
  async function setUserTrial(target: AdminUser) {
    const name = target.full_name || target.email;
    const input = prompt(t("admin.promptUserTrial", { name }), "14");
    if (input === null) return;
    const n = parseInt(input, 10);
    if (Number.isNaN(n) || n < 0 || n > 3650) {
      alert(t("admin.invalidDays"));
      return;
    }
    setBusyUser(target.id);
    const { data, error: rpcErr } = await supabase.rpc("admin_set_user_trial", {
      p_user: target.id,
      p_days: n,
    });
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || t("admin.trialUpdateError"));
      return;
    }
    const newEnd = typeof data === "string" ? data : null;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === target.id ? { ...u, trial_ends_at: newEnd } : u,
      ),
    );
  }

  // Acordă/retrage acces gratuit (cont fără abonament, fără drepturi de admin).
  async function toggleFreeAccess(target: AdminUser) {
    const makeFree = !target.free_access;
    const name = target.full_name || target.email;
    const msg = makeFree
      ? t("admin.confirmGrantFree", { name })
      : t("admin.confirmRevokeFree", { name });
    if (!confirm(msg)) return;
    setBusyUser(target.id);
    const { data, error: rpcErr } = await supabase.rpc(
      "admin_set_user_free_access",
      { p_user: target.id, p_value: makeFree },
    );
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || t("admin.freeAccessError"));
      return;
    }
    const saved = typeof data === "boolean" ? data : makeFree;
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, free_access: saved } : u)),
    );
  }

  async function setFeedbackStatus(id: string, status: string) {
    const prevRow = feedback.find((f) => f.id === id);
    const { error: upErr } = await supabase
      .from("feedback")
      .update({ status })
      .eq("id", id);
    if (!upErr) {
      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status } : f))
      );
      // Actualizează badge-ul „feedback nou" dacă a ieșit/intrat din „new".
      const wasNew = prevRow?.status === "new";
      const isNew = status === "new";
      if (wasNew !== isNew) {
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                new_feedback: Math.max(0, prev.new_feedback + (isNew ? 1 : -1)),
              }
            : prev
        );
      }
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── Error Center: agregă erorile din joburile deja logate ──
  const errorEvents = useMemo<ErrorEvent[]>(() => {
    const out: ErrorEvent[] = [];
    // Daily Focus — câte o intrare per eroare.
    for (const j of focusJobs) {
      for (const [i, er] of (j.errors ?? []).entries()) {
        out.push({
          id: `focus-${j.id}-${i}`,
          service: t("admin.serviceDailyFocus"),
          icon: "ti-sun",
          message: er.error,
          at: j.run_at,
        });
      }
    }
    // Import catalog — joburi eșuate.
    for (const imp of failedImports) {
      let msg = imp.records_failed
        ? t("admin.errorImportFailedProducts", { n: imp.records_failed })
        : t("admin.errorImportFailed");
      if (imp.error_log) {
        const raw =
          typeof imp.error_log === "string"
            ? imp.error_log
            : JSON.stringify(imp.error_log);
        if (raw && raw !== "[]" && raw !== "{}") {
          msg += ` — ${raw.slice(0, 200)}`;
        }
      }
      out.push({
        id: `import-${imp.id}`,
        service: t("admin.serviceCatalog"),
        icon: "ti-package",
        message: msg,
        at: imp.created_at,
      });
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30);
  }, [focusJobs, failedImports, t]);

  // ── Stări de acces ───────────────────────────────────────
  if (authorized === null) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: T.muted }}>
        {t("admin.checkingAccess")}
      </div>
    );
  }
  if (authorized === false) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <i
          className="ti ti-lock"
          style={{ fontSize: "40px", color: T.muted }}
        />
        <div style={{ marginTop: "12px", fontSize: "16px", color: T.espresso }}>
          {t("admin.noAccess")}
        </div>
        <div style={{ marginTop: "6px", fontSize: "13px", color: T.muted }}>
          {t("admin.redirecting")}
        </div>
      </div>
    );
  }

  const STATS = overview
    ? [
        {
          label: t("admin.stats.users"),
          value: overview.total_users,
          icon: "ti-users",
          bg: T.sageLight,
          color: T.sage,
        },
        {
          label: t("admin.stats.active7d"),
          value: overview.active_7d,
          icon: "ti-user-check",
          bg: T.greenLight,
          color: T.green,
        },
        {
          label: t("admin.stats.contacts"),
          value: overview.total_contacts,
          icon: "ti-address-book",
          bg: T.lavenderLight,
          color: T.lavender,
        },
        {
          label: t("admin.stats.offers"),
          value: overview.total_offers,
          icon: "ti-file-text",
          bg: T.linen,
          color: T.warm,
        },
        {
          label: t("admin.stats.emailsToday"),
          value: overview.emails_today,
          icon: "ti-mail-fast",
          bg: T.sageLight,
          color: T.sage,
        },
        {
          label: t("admin.stats.newFeedback"),
          value: overview.new_feedback,
          icon: "ti-message-2-heart",
          bg: T.redLight,
          color: T.red,
        },
      ]
    : [];

  return (
    <div style={{ fontFamily: "'DM Sans', Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "22px",
            fontWeight: 600,
            color: T.espresso,
          }}
        >
          <i className="ti ti-shield-lock" style={{ color: T.sage }} />
          {t("admin.title")}
        </div>
        <div style={{ fontSize: "13px", color: T.muted, marginTop: "4px" }}>
          {t("admin.subtitle")}
        </div>
      </div>

      {error && (
        <div
          style={{
            background: T.redLight,
            color: T.red,
            padding: "12px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i
                className={`ti ${s.icon}`}
                style={{ fontSize: "22px", color: s.color }}
              />
            </div>
            <div>
              <div
                style={{ fontSize: "24px", fontWeight: 700, color: T.espresso }}
              >
                {loading ? "—" : s.value}
              </div>
              <div style={{ fontSize: "12px", color: T.muted }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "16px",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        {(
          [
            { key: "users", label: t("admin.tabs.users"), icon: "ti-users" },
            {
              key: "feedback",
              label: t("admin.tabs.feedback"),
              icon: "ti-message-2-heart",
            },
            { key: "focus", label: t("admin.tabs.focus"), icon: "ti-sun" },
            {
              key: "catalog",
              label: t("admin.tabs.catalog"),
              icon: "ti-package",
            },
            {
              key: "codes",
              label: t("promo.admin.tab"),
              icon: "ti-ticket",
            },
            {
              key: "errors",
              label: t("admin.tabs.errors"),
              icon: "ti-alert-triangle",
            },
          ] as { key: Tab; label: string; icon: string }[]
        ).map((tabItem) => {
          const active = tab === tabItem.key;
          return (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                borderBottom: `2px solid ${active ? T.sage : "transparent"}`,
                color: active ? T.sageDark : T.muted,
                fontSize: "14px",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: "-1px",
              }}
            >
              <i className={`ti ${tabItem.icon}`} style={{ fontSize: "16px" }} />
              {tabItem.label}
              {tabItem.key === "feedback" &&
                overview &&
                overview.new_feedback > 0 && (
                <span
                  style={{
                    background: T.red,
                    color: T.white,
                    fontSize: "10px",
                    fontWeight: 700,
                    borderRadius: "999px",
                    padding: "1px 7px",
                  }}
                >
                  {overview.new_feedback}
                </span>
              )}
              {tabItem.key === "errors" && errorEvents.length > 0 && (
                <span
                  style={{
                    background: T.red,
                    color: T.white,
                    fontSize: "10px",
                    fontWeight: 700,
                    borderRadius: "999px",
                    padding: "1px 7px",
                  }}
                >
                  {errorEvents.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB: UTILIZATORI ────────────────────────────────── */}
      {tab === "users" && (
        <div>
          {/* Config trial global */}
          <div
            style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "16px 18px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <i
              className="ti ti-clock-hour-4"
              style={{ fontSize: "20px", color: T.sage }}
            />
            <div style={{ flex: 1, minWidth: "180px" }}>
              <div
                style={{ fontSize: "13px", fontWeight: 600, color: T.espresso }}
              >
                {t("admin.trialConfigTitle")}
              </div>
              <div style={{ fontSize: "12px", color: T.muted }}>
                {t("admin.trialConfigDesc")}
              </div>
            </div>
            <input
              type="number"
              min={0}
              max={365}
              value={trialInput}
              onChange={(e) => setTrialInput(e.target.value)}
              style={{
                width: "72px",
                padding: "8px 10px",
                background: T.cream,
                border: `1px solid ${T.border}`,
                borderRadius: "8px",
                fontSize: "13px",
                color: T.espresso,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <span style={{ fontSize: "13px", color: T.warm }}>
              {t("admin.daysLabel")}
            </span>
            <button
              onClick={saveTrialDays}
              disabled={trialSaving || trialInput === String(trialDays ?? "")}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "inherit",
                background:
                  trialSaving || trialInput === String(trialDays ?? "")
                    ? T.sageMid
                    : T.sage,
                color: T.white,
                border: "none",
                borderRadius: "8px",
                cursor:
                  trialSaving || trialInput === String(trialDays ?? "")
                    ? "default"
                    : "pointer",
              }}
            >
              {trialSaving ? t("common.saving") : t("common.save")}
            </button>
            {trialMsg && (
              <span
                style={{ fontSize: "12px", color: T.sageDark, width: "100%" }}
              >
                {trialMsg}
              </span>
            )}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.searchPlaceholder")}
            style={{
              width: "100%",
              maxWidth: "320px",
              padding: "10px 14px",
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: "10px",
              fontSize: "13px",
              color: T.espresso,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: "14px",
              boxSizing: "border-box",
            }}
          />

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("admin.loading")}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("admin.noUsersFound")}
            </div>
          ) : (
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ background: T.cream }}>
                      <th style={thStyle}>{t("admin.thUser")}</th>
                      <th style={thStyle}>{t("admin.thPlan")}</th>
                      <th style={thStyle}>{t("admin.thTrial")}</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        {t("admin.thContacts")}
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        {t("admin.thOffers")}
                      </th>
                      <th style={thStyle}>{t("admin.thSignedUp")}</th>
                      <th style={thStyle}>{t("admin.thLastLogin")}</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        {t("admin.thActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        style={{ borderTop: `1px solid ${T.border}` }}
                      >
                        <td style={tdStyle}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{ fontWeight: 500, color: T.espresso }}
                            >
                              {u.full_name || "—"}
                            </span>
                            {u.is_admin && (
                              <span
                                style={{
                                  background: T.sageLight,
                                  color: T.sageDark,
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  padding: "1px 6px",
                                }}
                              >
                                {t("admin.badgeAdmin")}
                              </span>
                            )}
                            {!u.is_admin && u.free_access && (
                              <span
                                style={{
                                  background: "#EAF4EF",
                                  color: T.green,
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  borderRadius: "6px",
                                  padding: "1px 6px",
                                }}
                              >
                                {t("admin.badgeFree")}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "12px", color: T.muted }}>
                            {u.email}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              background: T.linen,
                              color: T.warm,
                              fontSize: "12px",
                              fontWeight: 500,
                              borderRadius: "6px",
                              padding: "3px 8px",
                            }}
                          >
                            {PLAN_LABEL[u.subscription_plan ?? ""] ||
                              u.subscription_plan ||
                              "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {(() => {
                            const tl = trialLabel(u.trial_ends_at, t);
                            const isSubActive =
                              u.subscription_status === "active";
                            if (isSubActive)
                              return (
                                <span style={{ color: T.muted }}>—</span>
                              );
                            return (
                              <span
                                style={{
                                  color: tl.expired ? T.red : T.warm,
                                  fontWeight: tl.expired ? 600 : 400,
                                }}
                              >
                                {tl.text}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {u.contacts_count}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {u.offers_count}
                        </td>
                        <td style={{ ...tdStyle, color: T.muted }}>
                          {fmtDate(u.created_at)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            color: u.last_sign_in_at ? T.warm : T.muted,
                          }}
                        >
                          {fmtLastSeen(u.last_sign_in_at, t)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => setUserTrial(u)}
                              disabled={busyUser === u.id}
                              title={t("admin.setTrialTitle")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "5px 10px",
                                fontSize: "12px",
                                fontFamily: "inherit",
                                fontWeight: 500,
                                background: T.lavenderLight,
                                color: T.lavender,
                                border: "none",
                                borderRadius: "8px",
                                cursor:
                                  busyUser === u.id ? "default" : "pointer",
                                whiteSpace: "nowrap",
                                opacity: busyUser === u.id ? 0.6 : 1,
                              }}
                            >
                              <i className="ti ti-clock-plus" />
                              {t("admin.btnTrial")}
                            </button>
                            {!u.is_admin && (
                              <button
                                onClick={() => toggleFreeAccess(u)}
                                disabled={busyUser === u.id}
                                title={
                                  u.free_access
                                    ? t("admin.revokeFreeTitle")
                                    : t("admin.grantFreeTitle")
                                }
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                  fontFamily: "inherit",
                                  fontWeight: 500,
                                  background: u.free_access
                                    ? T.greenLight
                                    : T.linen,
                                  color: u.free_access ? T.green : T.warm,
                                  border: "none",
                                  borderRadius: "8px",
                                  cursor:
                                    busyUser === u.id ? "default" : "pointer",
                                  whiteSpace: "nowrap",
                                  opacity: busyUser === u.id ? 0.6 : 1,
                                }}
                              >
                                <i
                                  className={
                                    u.free_access
                                      ? "ti ti-gift-off"
                                      : "ti ti-gift"
                                  }
                                />
                                {u.free_access
                                  ? t("admin.btnRevokeFree")
                                  : t("admin.btnFree")}
                              </button>
                            )}
                            {u.id === user?.id ? (
                              <span
                                style={{ fontSize: "12px", color: T.muted }}
                              >
                                {t("admin.you")}
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleAdmin(u)}
                                disabled={busyUser === u.id}
                                title={
                                  u.is_admin
                                    ? t("admin.revokeAdminTitle")
                                    : t("admin.grantAdminTitle")
                                }
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "5px 10px",
                                  fontSize: "12px",
                                  fontFamily: "inherit",
                                  fontWeight: 500,
                                  background: u.is_admin
                                    ? T.redLight
                                    : T.sageLight,
                                  color: u.is_admin ? T.red : T.sageDark,
                                  border: "none",
                                  borderRadius: "8px",
                                  cursor:
                                    busyUser === u.id ? "default" : "pointer",
                                  whiteSpace: "nowrap",
                                  opacity: busyUser === u.id ? 0.6 : 1,
                                }}
                              >
                                <i
                                  className={
                                    u.is_admin
                                      ? "ti ti-shield-off"
                                      : "ti ti-shield-plus"
                                  }
                                />
                                {u.is_admin
                                  ? t("admin.btnRevokeAdmin")
                                  : t("admin.btnMakeAdmin")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: FEEDBACK ───────────────────────────────────── */}
      {tab === "feedback" && (
        <div>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("admin.loading")}
            </div>
          ) : feedback.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("admin.noFeedback")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {feedback.map((f) => {
                const typeKey = FEEDBACK_TYPE[f.type] ? f.type : "altele";
                const meta = FEEDBACK_TYPE[typeKey];
                const typeLabel = t(`admin.feedbackType.${typeKey}`);
                const isNew = f.status === "new";
                return (
                  <div
                    key={f.id}
                    style={{
                      background: T.white,
                      border: `1px solid ${isNew ? T.sageMid : T.border}`,
                      borderRadius: "14px",
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            background: T.sageLight,
                            color: T.sageDark,
                            fontSize: "12px",
                            fontWeight: 500,
                            borderRadius: "6px",
                            padding: "3px 8px",
                          }}
                        >
                          <i className={`ti ${meta.icon}`} />
                          {typeLabel}
                        </span>
                        {(() => {
                          const statusKey = FEEDBACK_STATUS[f.status]
                            ? f.status
                            : "new";
                          const st = FEEDBACK_STATUS[statusKey];
                          return (
                            <span
                              style={{
                                background: st.bg,
                                color: st.color,
                                fontSize: "11px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                padding: "2px 7px",
                              }}
                            >
                              {t(`admin.feedbackStatus.${statusKey}`)}
                            </span>
                          );
                        })()}
                      </div>
                      <span style={{ fontSize: "12px", color: T.muted }}>
                        {fmtDate(f.created_at)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: T.espresso,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {f.message}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginTop: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: T.muted }}>
                        {f.user_email || t("admin.anonymous")}
                        {f.page && (
                          <span style={{ marginLeft: "8px" }}>· {f.page}</span>
                        )}
                      </div>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                      >
                      {f.user_email && (
                        <a
                          href={`mailto:${f.user_email}?subject=${encodeURIComponent(
                            t("admin.replySubject")
                          )}&body=${encodeURIComponent(
                            t("admin.replyBody", {
                              type: typeLabel,
                              message: f.message,
                            })
                          )}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: 500,
                            background: T.white,
                            border: `1px solid ${T.border}`,
                            borderRadius: "8px",
                            color: T.warm,
                            textDecoration: "none",
                          }}
                        >
                          <i className="ti ti-mail" />
                          {t("admin.btnReply")}
                        </a>
                      )}
                      <select
                        value={f.status}
                        onChange={(e) =>
                          setFeedbackStatus(f.id, e.target.value)
                        }
                        style={{
                          padding: "6px 10px",
                          fontSize: "12px",
                          fontFamily: "inherit",
                          fontWeight: 500,
                          background: T.white,
                          border: `1px solid ${T.border}`,
                          borderRadius: "8px",
                          color: T.warm,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {t(`admin.feedbackStatus.${s}`)}
                          </option>
                        ))}
                      </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: DAILY FOCUS ────────────────────────────────── */}
      {tab === "focus" && (
        <div>
          {/* ── Consum email (Resend) ── */}
          <div
            style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "20px 22px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: T.espresso,
                marginBottom: "4px",
              }}
            >
              {t("admin.emailUsageTitle")}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: T.muted,
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              {t("admin.emailUsageDesc")}
            </div>

            {emailUsageErr ? (
              <div
                style={{
                  padding: "10px 14px",
                  background: T.redLight,
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: T.red,
                }}
              >
                {emailUsageErr}
              </div>
            ) : !emailUsage ? (
              <div style={{ fontSize: "13px", color: T.muted }}>
                {t("admin.loading")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  {
                    label: t("admin.emailUsageMonth"),
                    used: emailUsage.month_total,
                    limit: RESEND_MONTH_LIMIT,
                    offers: emailUsage.month_offers,
                    account: emailUsage.month_account,
                  },
                  {
                    label: t("admin.emailUsageDay"),
                    used: emailUsage.day_total,
                    limit: RESEND_DAY_LIMIT,
                    offers: emailUsage.day_offers,
                    account: emailUsage.day_account,
                  },
                ].map((row) => {
                  const ratio = Math.min(1, row.used / row.limit);
                  const barColor =
                    ratio >= 0.9 ? T.red : ratio >= 0.7 ? "#D9A441" : T.sage;
                  return (
                    <div key={row.label}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: T.espresso,
                          }}
                        >
                          {row.label}
                        </span>
                        <span style={{ fontSize: "13px", color: T.warm }}>
                          {t("admin.emailUsageOfLimit", {
                            used: row.used,
                            limit: row.limit,
                          })}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          background: T.linen,
                          borderRadius: "999px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${ratio * 100}%`,
                            background: barColor,
                            borderRadius: "999px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: "5px",
                          fontSize: "12px",
                          color: T.muted,
                        }}
                      >
                        {t("admin.emailUsageBreakdown", {
                          offers: row.offers,
                          account: row.account,
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              background: T.white,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              padding: "20px 22px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: T.espresso,
                marginBottom: "4px",
              }}
            >
              {t("admin.focusTitle")}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: T.muted,
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              {t("admin.focusDesc")}
            </div>
            <button
              onClick={testDailyFocus}
              disabled={focusTesting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 18px",
                fontSize: "13px",
                fontFamily: "inherit",
                fontWeight: 600,
                background: focusTesting ? T.sageMid : T.sage,
                border: "none",
                borderRadius: "10px",
                color: T.white,
                cursor: focusTesting ? "default" : "pointer",
              }}
            >
              <i
                className={focusTesting ? "ti ti-loader-2" : "ti ti-send"}
                style={{ fontSize: "15px" }}
              />
              {focusTesting
                ? t("admin.focusRunning")
                : t("admin.focusSendProbe")}
            </button>

            {focusTestMsg && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: T.greenLight,
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: T.green,
                }}
              >
                {focusTestMsg}
              </div>
            )}
            {focusTestErr && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: T.redLight,
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: T.red,
                }}
              >
                {focusTestErr}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: T.warm,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 4px 10px",
            }}
          >
            {t("admin.lastRuns")}
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: T.muted }}>
              {t("admin.loading")}
            </div>
          ) : focusJobs.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: T.muted }}>
              {t("admin.noRuns")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {focusJobs.map((j) => (
                <div
                  key={j.id}
                  style={{
                    background: T.white,
                    border: `1px solid ${
                      j.emails_failed > 0 ? T.redLight : T.border
                    }`,
                    borderRadius: "12px",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "13px",
                        color: T.espresso,
                      }}
                    >
                      <span style={{ color: T.muted }}>
                        {new Date(j.run_at).toLocaleString(uiLocale(i18n.language))}
                      </span>
                      {j.trigger === "manual" && (
                        <span
                          style={{
                            background: T.lavenderLight,
                            color: T.lavender,
                            fontSize: "11px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            padding: "1px 7px",
                          }}
                        >
                          {t("admin.focusTestBadge")}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: T.muted }}>
                        {t("admin.usersProcessed", { n: j.users_processed })}
                      </span>
                      <span style={{ color: T.green, fontWeight: 600 }}>
                        {t("admin.emailsSent", { n: j.emails_sent })}
                      </span>
                      {j.emails_failed > 0 && (
                        <span style={{ color: T.red, fontWeight: 600 }}>
                          {t("admin.emailsFailed", { n: j.emails_failed })}
                        </span>
                      )}
                    </div>
                  </div>
                  {j.errors && j.errors.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: T.red,
                        lineHeight: 1.5,
                      }}
                    >
                      {j.errors.slice(0, 3).map((er, idx) => (
                        <div key={idx}>· {er.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CATALOG PRODUSE ────────────────────────────── */}
      {tab === "catalog" && (
        <div
          style={{
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: "14px",
            padding: "24px",
            maxWidth: "560px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "15px",
              fontWeight: 600,
              color: T.espresso,
              marginBottom: "6px",
            }}
          >
            <i className="ti ti-package" style={{ color: T.sage }} />
            {t("admin.catalogTitle")}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: T.muted,
              lineHeight: 1.6,
              marginBottom: "18px",
            }}
          >
            {t("admin.catalogDesc")}
          </div>

          {lastJob && (
            <div
              style={{
                background: T.cream,
                border: `1px solid ${T.border}`,
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: T.espresso,
                  marginBottom: "2px",
                }}
              >
                {t("admin.lastSync")}
              </div>
              <div style={{ color: T.muted }}>
                {new Date(lastJob.created_at).toLocaleString(uiLocale(i18n.language))} —{" "}
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      lastJob.status === "done"
                        ? T.green
                        : lastJob.status === "failed"
                          ? T.red
                          : T.muted,
                  }}
                >
                  {lastJob.status === "done"
                    ? t("admin.statusDone")
                    : lastJob.status === "failed"
                      ? t("admin.statusFailed")
                      : lastJob.status}
                </span>
                {lastJob.records_imported != null &&
                  t("admin.syncProducts", { n: lastJob.records_imported })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: T.espresso,
                marginBottom: "6px",
              }}
            >
              {t("admin.countryLabel")}
            </label>
            <select
              value={importCountry}
              onChange={(e) => setImportCountry(e.target.value)}
              disabled={syncing}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: T.cream,
                border: `1px solid ${T.border}`,
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 600,
                color: T.espresso,
                fontFamily: "inherit",
                cursor: syncing ? "not-allowed" : "pointer",
                outline: "none",
              }}
            >
              <option value="RO">{t("admin.countryRO")}</option>
              <option value="DE">{t("admin.countryDE")}</option>
              <option value="FR">{t("admin.countryFR")}</option>
              <option value="IT">{t("admin.countryIT")}</option>
              <option value="ES">{t("admin.countryES")}</option>
              <option value="NL">{t("admin.countryNL")}</option>
              <option value="BE">{t("admin.countryBE")}</option>
              <option value="AT">{t("admin.countryAT")}</option>
              <option value="IE">{t("admin.countryIE")}</option>
              <option value="PT">{t("admin.countryPT")}</option>
              <option value="FI">{t("admin.countryFI")}</option>
              <option value="GB">{t("admin.countryGB")}</option>
              <option value="MD">{t("admin.countryMD")}</option>
              <option value="UA">{t("admin.countryUA")}</option>
            </select>
          </div>

          <button
            onClick={syncProducts}
            disabled={syncing}
            style={{
              width: "100%",
              padding: "12px",
              background: syncing ? T.sageMid : T.sage,
              border: "none",
              borderRadius: "10px",
              color: T.white,
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: syncing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
            }}
          >
            <i
              className={syncing ? "ti ti-loader-2" : "ti ti-refresh"}
              style={{ fontSize: "15px" }}
            />
            {syncing
              ? t("admin.syncing")
              : t("admin.syncCatalog", { country: importCountry })}
          </button>

          <button
            onClick={syncAllProducts}
            disabled={syncing}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "12px",
              background: T.white,
              border: `1px solid ${T.sage}`,
              borderRadius: "10px",
              color: T.sage,
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: syncing ? "not-allowed" : "pointer",
              opacity: syncing ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
            }}
          >
            <i className="ti ti-world-download" style={{ fontSize: "15px" }} />
            {t("admin.importAll")}
          </button>

          {syncing && syncProgress && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: T.warm,
                textAlign: "center",
              }}
            >
              {syncProgress}
            </div>
          )}

          {syncResult && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                background: T.greenLight,
                border: `1px solid rgba(46,138,88,0.2)`,
                borderRadius: "10px",
                fontSize: "13px",
                color: T.green,
                display: "flex",
                alignItems: "flex-start",
                gap: "7px",
              }}
            >
              <i
                className="ti ti-circle-check"
                style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}
              />
              {syncResult}
            </div>
          )}

          {syncError && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                background: T.redLight,
                border: `1px solid rgba(201,79,106,0.2)`,
                borderRadius: "10px",
                fontSize: "13px",
                color: T.red,
                display: "flex",
                alignItems: "flex-start",
                gap: "7px",
              }}
            >
              <i
                className="ti ti-alert-circle"
                style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}
              />
              {syncError}
            </div>
          )}

          {/* ── Status detaliat pe țară ───────────────────────── */}
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: T.espresso,
                marginBottom: "4px",
              }}
            >
              {t("admin.catalogBreakdown")}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: T.muted,
                marginBottom: "10px",
                lineHeight: 1.5,
              }}
            >
              {t("admin.catalogBreakdownHint")}
            </div>
            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.9fr 1.1fr 0.9fr",
                  gap: "8px",
                  padding: "9px 14px",
                  background: T.cream,
                  borderBottom: `1px solid ${T.border}`,
                  fontSize: "11px",
                  fontWeight: 600,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                <div>{t("admin.colCountry")}</div>
                <div style={{ textAlign: "right" }}>{t("admin.colProducts")}</div>
                <div style={{ textAlign: "right" }}>{t("admin.colNew")}</div>
                <div style={{ textAlign: "right" }}>{t("admin.colUpdated")}</div>
                <div>{t("admin.colWhen")}</div>
                <div style={{ textAlign: "right" }}>{t("admin.colStatus")}</div>
              </div>
              {IMPORT_COUNTRIES.map((code, idx) => {
                const job = countryJobs[code];
                const statusColor =
                  job?.status === "done"
                    ? T.green
                    : job?.status === "failed"
                      ? T.red
                      : T.muted;
                const statusLabel = !job
                  ? t("admin.statusNever")
                  : job.status === "done"
                    ? t("admin.statusDone")
                    : job.status === "failed"
                      ? t("admin.statusFailed")
                      : job.status === "running"
                        ? t("admin.statusRunning")
                        : job.status;
                const deactivated = job?.records_deactivated ?? 0;
                const skipped = job?.records_failed ?? 0;
                // Tooltip nativ cu detaliile care nu au coloană proprie.
                const rowTitle = job
                  ? [
                      t("admin.tipSkipped", { n: skipped }),
                      t("admin.tipDeactivated", { n: deactivated }),
                    ].join(" · ")
                  : undefined;
                return (
                  <div
                    key={code}
                    title={rowTitle}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.9fr 1.1fr 0.9fr",
                      gap: "8px",
                      padding: "9px 14px",
                      alignItems: "center",
                      fontSize: "12.5px",
                      color: T.espresso,
                      borderBottom:
                        idx === IMPORT_COUNTRIES.length - 1
                          ? "none"
                          : `1px solid ${T.border}`,
                      background: job ? T.white : T.cream,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: "6px" }}>
                        {COUNTRY_FLAGS[code] ?? "🏳️"}
                      </span>
                      {code}
                      {deactivated > 0 && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: T.red,
                          }}
                        >
                          {t("admin.tagDeactivated", { n: deactivated })}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {job?.records_imported != null ? job.records_imported : "—"}
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: job?.records_new ? T.green : T.muted,
                        fontWeight: job?.records_new ? 600 : 400,
                      }}
                    >
                      {job?.records_new != null ? job.records_new : "—"}
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: job?.records_updated ? T.espresso : T.muted,
                        fontWeight: job?.records_updated ? 600 : 400,
                      }}
                    >
                      {job?.records_updated != null ? job.records_updated : "—"}
                    </div>
                    <div style={{ color: T.muted }}>
                      {job
                        ? new Date(job.created_at).toLocaleString(
                            uiLocale(i18n.language),
                            {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "11.5px",
                          color: statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: CODURI ─────────────────────────────────────── */}
      {tab === "codes" && (
        <div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: T.espresso,
              margin: "0 4px 16px",
            }}
          >
            {t("promo.admin.heading")}
          </div>

          {promoErr && (
            <div
              style={{
                background: T.redLight,
                color: T.red,
                border: `1px solid ${T.red}`,
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              {promoErr}
            </div>
          )}

          {/* Formular: creare cod */}
          <div style={{ maxWidth: "520px", marginBottom: "18px" }}>
            {/* Creare cod unic */}
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: T.espresso,
                  marginBottom: "16px",
                }}
              >
                <i className="ti ti-ticket" style={{ color: T.sage }} />
                {t("promo.admin.createTitle")}
              </div>

              <FieldLabel>{t("promo.admin.codeLabel")}</FieldLabel>
              <input
                value={pcCode}
                onChange={(e) => setPcCode(e.target.value.toUpperCase())}
                placeholder={t("promo.admin.codePlaceholder")}
                style={inputStyle}
              />

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 120 }}>
                  <FieldLabel>{t("promo.admin.daysLabel")}</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={pcDays}
                    onChange={(e) => setPcDays(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <FieldLabel>{t("promo.admin.maxLabel")}</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    value={pcMax}
                    onChange={(e) => setPcMax(e.target.value)}
                    placeholder={t("promo.admin.maxHint")}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <FieldLabel>{t("promo.admin.expiresLabel")}</FieldLabel>
                <input
                  type="date"
                  value={pcExpires}
                  onChange={(e) => setPcExpires(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginTop: "12px" }}>
                <FieldLabel>{t("promo.admin.noteLabel")}</FieldLabel>
                <input
                  value={pcNote}
                  onChange={(e) => setPcNote(e.target.value)}
                  placeholder={t("promo.admin.notePlaceholder")}
                  style={inputStyle}
                />
              </div>

              <button
                onClick={createPromoCode}
                disabled={pcCreating}
                style={{
                  ...primaryBtn,
                  marginTop: "16px",
                  opacity: pcCreating ? 0.6 : 1,
                  cursor: pcCreating ? "default" : "pointer",
                }}
              >
                {pcCreating
                  ? t("promo.admin.creating")
                  : t("promo.admin.create")}
              </button>
            </div>
          </div>

          {/* Listă coduri existente */}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: T.espresso,
              margin: "0 4px 10px",
            }}
          >
            {t("promo.admin.listTitle")}
          </div>

          {promoLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("promo.admin.loading")}
            </div>
          ) : promoCodes.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: T.muted,
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
              }}
            >
              {t("promo.admin.noCodes")}
            </div>
          ) : (
            <div
              style={{
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "640px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    <th style={thStyle}>{t("promo.admin.colCode")}</th>
                    <th style={thStyle}>{t("promo.admin.colDays")}</th>
                    <th style={thStyle}>{t("promo.admin.colUsed")}</th>
                    <th style={thStyle}>{t("promo.admin.colExpires")}</th>
                    <th style={thStyle}>{t("promo.admin.colStatus")}</th>
                    <th style={thStyle}>{t("promo.admin.colNote")}</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((pc) => (
                    <tr
                      key={pc.id}
                      style={{ borderBottom: `1px solid ${T.border}` }}
                    >
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: T.espresso,
                          }}
                        >
                          {pc.code}
                        </span>
                      </td>
                      <td style={tdStyle}>{pc.trial_days}</td>
                      <td style={tdStyle}>
                        {pc.redeemed_count} /{" "}
                        {pc.max_redemptions == null
                          ? t("promo.admin.unlimited")
                          : pc.max_redemptions}
                      </td>
                      <td style={{ ...tdStyle, color: T.muted, fontSize: "13px" }}>
                        {pc.expires_at
                          ? fmtDate(pc.expires_at)
                          : t("promo.admin.never")}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "12px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            padding: "2px 8px",
                            background: pc.active ? T.greenLight : T.linen,
                            color: pc.active ? T.green : T.muted,
                          }}
                        >
                          {pc.active
                            ? t("promo.admin.active")
                            : t("promo.admin.inactive")}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: T.muted, fontSize: "13px" }}>
                        {pc.note || "—"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          onClick={() => togglePromoActive(pc)}
                          style={{
                            background: "transparent",
                            border: `1px solid ${T.border}`,
                            borderRadius: "8px",
                            padding: "5px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: pc.active ? T.red : T.sageDark,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pc.active
                            ? t("promo.admin.disable")
                            : t("promo.admin.enable")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ERORI ──────────────────────────────────────── */}
      {tab === "errors" && (
        <div>
          <div
            style={{
              fontSize: "13px",
              color: T.muted,
              lineHeight: 1.6,
              margin: "0 4px 14px",
            }}
          >
            {t("admin.errorsDesc")}
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              {t("admin.loading")}
            </div>
          ) : errorEvents.length === 0 ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: T.green,
                background: T.white,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
              }}
            >
              <i
                className="ti ti-circle-check"
                style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}
              />
              {t("admin.noErrors")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {errorEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: T.white,
                    border: `1px solid ${T.redLight}`,
                    borderLeft: `3px solid ${T.red}`,
                    borderRadius: "12px",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginBottom: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: T.linen,
                        color: T.warm,
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        padding: "2px 8px",
                      }}
                    >
                      <i className={`ti ${ev.icon}`} />
                      {ev.service}
                    </span>
                    <span style={{ fontSize: "12px", color: T.muted }}>
                      {fmtDateTime(ev.at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: T.espresso,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {ev.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: 600,
  color: T.warm,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

// ── Stiluri formular pentru tabul „Coduri" ─────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: T.cream,
  border: `1px solid ${T.border}`,
  borderRadius: "10px",
  fontSize: "13px",
  color: T.espresso,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "11px 16px",
  background: T.sage,
  color: T.white,
  border: "none",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 600,
  fontFamily: "inherit",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "12px",
        fontWeight: 600,
        color: T.espresso,
        marginBottom: "6px",
      }}
    >
      {children}
    </label>
  );
}
