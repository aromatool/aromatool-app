import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

type Tab = "users" | "feedback" | "focus" | "catalog" | "errors";

// Statusuri feedback (operare: triaj simplu).
const FEEDBACK_STATUS: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  new: { label: "Nou", bg: "#FFF0F4", color: "#C94F6A" },
  reviewed: { label: "Văzut", bg: "#E8F0E8", color: "#4A6A4A" },
  planned: { label: "Planificat", bg: "#F0EEF8", color: "#9888B8" },
  done: { label: "Rezolvat", bg: "#E8F8F0", color: "#2E8A58" },
};
const STATUS_ORDER = ["new", "reviewed", "planned", "done"];

const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  team: "Team",
  business: "Business",
};

const FEEDBACK_TYPE: Record<string, { label: string; icon: string }> = {
  sugestie: { label: "Sugestie", icon: "ti-bulb" },
  problema: { label: "Problemă", icon: "ti-alert-triangle" },
  altele: { label: "Altele", icon: "ti-message" },
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
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
    return new Date(iso).toLocaleString("ro-RO", {
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
function fmtLastSeen(iso: string | null): string {
  if (!iso) return "niciodată";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  if (days < 7) return `acum ${days} zile`;
  return fmtDate(iso);
}

// Stare trial scurtă pentru tabelul de utilizatori.
function trialLabel(iso: string | null): { text: string; expired: boolean } {
  if (!iso) return { text: "—", expired: false };
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return { text: "—", expired: false };
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) return { text: "expirat", expired: true };
  if (days === 1) return { text: "1 zi", expired: false };
  return { text: `${days} zile`, expired: false };
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [syncError, setSyncError] = useState("");

  // ── Daily Focus ──────────────────────────────────────────
  const [focusJobs, setFocusJobs] = useState<FocusJob[]>([]);
  const [focusTesting, setFocusTesting] = useState(false);
  const [focusTestMsg, setFocusTestMsg] = useState("");
  const [focusTestErr, setFocusTestErr] = useState("");

  // ── Error Center ─────────────────────────────────────────
  const [failedImports, setFailedImports] = useState<FailedImport[]>([]);

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
        setError("Nu am putut încărca datele de admin.");
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
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorized]);

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
  }

  async function syncProducts() {
    setSyncing(true);
    setSyncError("");
    setSyncResult("");
    try {
      const { data, error: fnError } =
        await supabase.functions.invoke("import-products");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSyncResult(
        `${data.imported} produse importate / actualizate` +
          (data.deactivated ? `, ${data.deactivated} dezactivate` : "") +
          (data.skipped ? `, ${data.skipped} ignorate (NFR / fără preț)` : "")
      );
      await loadLastJob();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sincronizarea a eșuat.");
    } finally {
      setSyncing(false);
    }
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
          ? `Trimis! ${data.sent} email(uri), ${data.processed} procesat(e).`
          : "Rulare ok — Focus Today gol acum, deci nu s-a trimis niciun email."
      );
      // Reîncarcă jobs ca să apară rularea de test.
      const { data: fresh } = await supabase
        .from("daily_focus_jobs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(20);
      setFocusJobs((fresh as FocusJob[]) ?? []);
    } catch (e) {
      setFocusTestErr(e instanceof Error ? e.message : "Rularea a eșuat.");
    } finally {
      setFocusTesting(false);
    }
  }

  const [busyUser, setBusyUser] = useState<string | null>(null);

  async function toggleAdmin(target: AdminUser) {
    const makeAdmin = !target.is_admin;
    const name = target.full_name || target.email;
    const msg = makeAdmin
      ? `Acorzi drepturi de admin lui ${name}?`
      : `Retragi drepturile de admin lui ${name}?`;
    if (!confirm(msg)) return;
    setBusyUser(target.id);
    const { error: rpcErr } = await supabase.rpc("admin_set_user_admin", {
      target_id: target.id,
      make_admin: makeAdmin,
    });
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || "Nu am putut actualiza rolul.");
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
      setTrialMsg("Introdu un număr între 0 și 365.");
      return;
    }
    setTrialSaving(true);
    setTrialMsg("");
    const { data, error: rpcErr } = await supabase.rpc("admin_set_trial_days", {
      p_days: n,
    });
    setTrialSaving(false);
    if (rpcErr) {
      setTrialMsg(rpcErr.message || "Nu am putut salva.");
      return;
    }
    const saved = typeof data === "number" ? data : n;
    setTrialDays(saved);
    setTrialInput(String(saved));
    setTrialMsg(`Salvat: ${saved} zile pentru conturile noi.`);
    setTimeout(() => setTrialMsg(""), 3000);
  }

  // Setează trialul unui utilizator la „azi + X zile".
  async function setUserTrial(target: AdminUser) {
    const name = target.full_name || target.email;
    const input = prompt(
      `Câte zile de trial primește ${name}? (de azi înainte)`,
      "14",
    );
    if (input === null) return;
    const n = parseInt(input, 10);
    if (Number.isNaN(n) || n < 0 || n > 3650) {
      alert("Număr de zile invalid (0–3650).");
      return;
    }
    setBusyUser(target.id);
    const { data, error: rpcErr } = await supabase.rpc("admin_set_user_trial", {
      p_user: target.id,
      p_days: n,
    });
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || "Nu am putut actualiza trialul.");
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
      ? `Acorzi acces gratuit (fără plată) lui ${name}?`
      : `Retragi accesul gratuit lui ${name}?`;
    if (!confirm(msg)) return;
    setBusyUser(target.id);
    const { data, error: rpcErr } = await supabase.rpc(
      "admin_set_user_free_access",
      { p_user: target.id, p_value: makeFree },
    );
    setBusyUser(null);
    if (rpcErr) {
      alert(rpcErr.message || "Nu am putut actualiza accesul gratuit.");
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
          service: "Daily Focus",
          icon: "ti-sun",
          message: er.error,
          at: j.run_at,
        });
      }
    }
    // Import catalog — joburi eșuate.
    for (const imp of failedImports) {
      let msg = `Import eșuat${imp.records_failed ? ` · ${imp.records_failed} produse` : ""}`;
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
        service: "Catalog produse",
        icon: "ti-package",
        message: msg,
        at: imp.created_at,
      });
    }
    return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30);
  }, [focusJobs, failedImports]);

  // ── Stări de acces ───────────────────────────────────────
  if (authorized === null) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: T.muted }}>
        Se verifică accesul…
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
          Nu ai acces la această pagină.
        </div>
        <div style={{ marginTop: "6px", fontSize: "13px", color: T.muted }}>
          Te redirecționăm…
        </div>
      </div>
    );
  }

  const STATS = overview
    ? [
        {
          label: "Utilizatori",
          value: overview.total_users,
          icon: "ti-users",
          bg: T.sageLight,
          color: T.sage,
        },
        {
          label: "Activi (7z)",
          value: overview.active_7d,
          icon: "ti-user-check",
          bg: T.greenLight,
          color: T.green,
        },
        {
          label: "Contacte",
          value: overview.total_contacts,
          icon: "ti-address-book",
          bg: T.lavenderLight,
          color: T.lavender,
        },
        {
          label: "Oferte",
          value: overview.total_offers,
          icon: "ti-file-text",
          bg: T.linen,
          color: T.warm,
        },
        {
          label: "Emailuri azi",
          value: overview.emails_today,
          icon: "ti-mail-fast",
          bg: T.sageLight,
          color: T.sage,
        },
        {
          label: "Feedback nou",
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
          Panou admin
        </div>
        <div style={{ fontSize: "13px", color: T.muted, marginTop: "4px" }}>
          Privire de ansamblu asupra platformei AromaTool.
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
            { key: "users", label: "Utilizatori", icon: "ti-users" },
            { key: "feedback", label: "Feedback", icon: "ti-message-2-heart" },
            { key: "focus", label: "Daily Focus", icon: "ti-sun" },
            { key: "catalog", label: "Catalog produse", icon: "ti-package" },
            { key: "errors", label: "Erori", icon: "ti-alert-triangle" },
          ] as { key: Tab; label: string; icon: string }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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
              <i className={`ti ${t.icon}`} style={{ fontSize: "16px" }} />
              {t.label}
              {t.key === "feedback" && overview && overview.new_feedback > 0 && (
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
              {t.key === "errors" && errorEvents.length > 0 && (
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
                Perioadă de trial pentru conturi noi
              </div>
              <div style={{ fontSize: "12px", color: T.muted }}>
                Se aplică instant la conturile create de acum înainte.
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
            <span style={{ fontSize: "13px", color: T.warm }}>zile</span>
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
              {trialSaving ? "Se salvează…" : "Salvează"}
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
            placeholder="Caută după nume sau email…"
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
              Se încarcă…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              Niciun utilizator găsit.
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
                      <th style={thStyle}>Utilizator</th>
                      <th style={thStyle}>Plan</th>
                      <th style={thStyle}>Trial</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Contacte</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Oferte</th>
                      <th style={thStyle}>Înscris</th>
                      <th style={thStyle}>Ultim login</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Acțiuni</th>
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
                                admin
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
                                gratuit
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
                            const t = trialLabel(u.trial_ends_at);
                            const isSubActive =
                              u.subscription_status === "active";
                            if (isSubActive)
                              return (
                                <span style={{ color: T.muted }}>—</span>
                              );
                            return (
                              <span
                                style={{
                                  color: t.expired ? T.red : T.warm,
                                  fontWeight: t.expired ? 600 : 400,
                                }}
                              >
                                {t.text}
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
                          {fmtLastSeen(u.last_sign_in_at)}
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
                              title="Setează zile de trial (de azi)"
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
                              Trial
                            </button>
                            {!u.is_admin && (
                              <button
                                onClick={() => toggleFreeAccess(u)}
                                disabled={busyUser === u.id}
                                title={
                                  u.free_access
                                    ? "Retrage accesul gratuit"
                                    : "Acordă acces gratuit (fără plată)"
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
                                {u.free_access ? "Retrage gratuit" : "Gratuit"}
                              </button>
                            )}
                            {u.id === user?.id ? (
                              <span
                                style={{ fontSize: "12px", color: T.muted }}
                              >
                                tu
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleAdmin(u)}
                                disabled={busyUser === u.id}
                                title={
                                  u.is_admin ? "Retrage admin" : "Acordă admin"
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
                                {u.is_admin ? "Retrage admin" : "Fă admin"}
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
              Se încarcă…
            </div>
          ) : feedback.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              Niciun feedback încă.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {feedback.map((f) => {
                const meta = FEEDBACK_TYPE[f.type] || FEEDBACK_TYPE.altele;
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
                          {meta.label}
                        </span>
                        {(() => {
                          const st =
                            FEEDBACK_STATUS[f.status] || FEEDBACK_STATUS.new;
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
                              {st.label}
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
                        {f.user_email || "anonim"}
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
                            "Răspuns la feedback-ul tău · AromaTool"
                          )}&body=${encodeURIComponent(
                            `\n\n———\nLa feedback-ul tău (${meta.label}):\n"${f.message}"`
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
                          Răspunde
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
                            {FEEDBACK_STATUS[s].label}
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
              Daily Focus Email
            </div>
            <div
              style={{
                fontSize: "13px",
                color: T.muted,
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              Cron-ul rulează din oră în oră și trimite fiecărui user, la ora
              lui locală, contactele care merită atenție azi. Nu trimite nimic
              dacă Focus Today e gol. Butonul de mai jos rulează manual o probă
              pentru contul tău (ignoră ora aleasă).
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
              {focusTesting ? "Se rulează…" : "Trimite-mi o probă acum"}
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
            Ultimele rulări
          </div>

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: T.muted }}>
              Se încarcă…
            </div>
          ) : focusJobs.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: T.muted }}>
              Nicio rulare încă.
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
                        {new Date(j.run_at).toLocaleString("ro-RO")}
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
                          test
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
                        {j.users_processed} procesați
                      </span>
                      <span style={{ color: T.green, fontWeight: 600 }}>
                        {j.emails_sent} trimise
                      </span>
                      {j.emails_failed > 0 && (
                        <span style={{ color: T.red, fontWeight: 600 }}>
                          {j.emails_failed} eșuate
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
            Catalog Young Living
          </div>
          <div
            style={{
              fontSize: "13px",
              color: T.muted,
              lineHeight: 1.6,
              marginBottom: "18px",
            }}
          >
            Sincronizează produsele din catalogul Young Living. Importă /
            actualizează produsele și dezactivează automat ce nu mai apare în
            catalog.
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
                Ultima sincronizare
              </div>
              <div style={{ color: T.muted }}>
                {new Date(lastJob.created_at).toLocaleString("ro-RO")} —{" "}
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
                    ? "reușită"
                    : lastJob.status === "failed"
                      ? "eșuată"
                      : lastJob.status}
                </span>
                {lastJob.records_imported != null &&
                  ` · ${lastJob.records_imported} produse`}
              </div>
            </div>
          )}

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
              ? "Se sincronizează…"
              : "Sincronizează produse din Young Living"}
          </button>

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
            Ultimele erori din sistemele automate (Daily Focus și import
            catalog). Dacă lista e goală, totul a rulat curat.
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.muted }}>
              Se încarcă…
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
              Nicio eroare recentă. 🌿
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
