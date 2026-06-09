import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { useUpgrade } from "../hooks/useUpgrade";

// ============================================================
// SUBSCRIPTION — sursa unică de adevăr pentru acces în aplicație.
// Reguli: are acces dacă abonamentul e activ SAU dacă încă e în
// perioada de trial (azi < trial_ends_at). „Poartă blândă":
// citirile + exportul merg mereu; scrierile cheamă requireAccess()
// care deschide modalul de plată dacă nu există acces.
// ============================================================

// ── CONFIG PLAN (editabil) ──────────────────────────────────
// Un singur plan, facturare lunară. Textul de preț e doar pentru
// afișare; suma reală vine din Stripe (STRIPE_PRICE_PRO).
export const PLAN = {
  id: "pro",
  name: "AromaTool Pro",
  priceText: "99 RON / lună",
  tagline: "Tot ce ai nevoie ca să-ți crești echipa.",
  features: [
    "Contacte și CRM nelimitate",
    "Calculator de oferte și oferte personalizate",
    "Mesaje și follow-up automat",
    "Bibliotecă de resurse",
    "Suport prioritar",
  ],
} as const;

interface SubscriptionState {
  plan: string | null;
  status: string | null;
  trialEndsAt: Date | null;
  daysLeft: number; // zile rămase din trial (0 dacă a expirat / nu e în trial)
  isActive: boolean; // abonament Stripe activ
  isTrialing: boolean; // în perioada de trial validă
  isPastDue: boolean; // plată eșuată
  isAdmin: boolean; // admin — acces total, fără gating
  freeAccess: boolean; // acces gratuit acordat de admin (non-admin)
  hasAccess: boolean; // isAdmin || freeAccess || isActive || isTrialing
  loading: boolean;
  refresh: () => Promise<void>;
  // Returnează true dacă are acces; altfel deschide paywall-ul și
  // returnează false. Folosit ca poartă pe acțiunile de scriere.
  requireAccess: () => boolean;
  openPaywall: () => void;
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(
  undefined,
);

function daysBetween(future: Date): number {
  const ms = future.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [freeAccess, setFreeAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPlan(null);
      setStatus(null);
      setTrialEndsAt(null);
      setIsAdmin(false);
      setFreeAccess(false);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "subscription_plan, subscription_status, trial_ends_at, is_admin, free_access",
      )
      .eq("id", user.id)
      .single();
    setPlan(data?.subscription_plan ?? null);
    setStatus(data?.subscription_status ?? null);
    setTrialEndsAt(data?.trial_ends_at ? new Date(data.trial_ends_at) : null);
    setIsAdmin(data?.is_admin ?? false);
    setFreeAccess(data?.free_access ?? false);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const isActive = status === "active";
  const isPastDue = status === "past_due";
  const daysLeft = trialEndsAt ? daysBetween(trialEndsAt) : 0;
  const isTrialing = !isActive && daysLeft > 0;
  // Adminii și utilizatorii cu acces gratuit (acordat de admin) au mereu
  // acces — fără trial, fără paywall.
  const hasAccess = isAdmin || freeAccess || isActive || isTrialing;

  const openPaywall = useCallback(() => setPaywallOpen(true), []);

  const requireAccess = useCallback((): boolean => {
    if (hasAccess) return true;
    setPaywallOpen(true);
    return false;
  }, [hasAccess]);

  const value: SubscriptionState = {
    plan,
    status,
    trialEndsAt,
    daysLeft,
    isActive,
    isTrialing,
    isPastDue,
    isAdmin,
    freeAccess,
    hasAccess,
    loading,
    refresh,
    requireAccess,
    openPaywall,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      {paywallOpen && <Paywall onClose={() => setPaywallOpen(false)} />}
    </SubscriptionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx)
    throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}

// ── PAYWALL MODAL ───────────────────────────────────────────
const C = {
  sage: "#5C7A5C",
  sageDark: "#4A6A4A",
  sageLight: "#E8F0E8",
  cream: "#FAFAF7",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  green: "#2E8A58",
};

function Paywall({ onClose }: { onClose: () => void }) {
  const { upgrade, loading, error } = useUpgrade();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,53,48,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: "20px",
          maxWidth: "420px",
          width: "100%",
          padding: "32px 28px",
          boxShadow: "0 16px 48px rgba(60,53,48,0.24)",
          fontFamily: "'DM Sans', Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Închide"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "18px",
            color: C.muted,
            lineHeight: 1,
          }}
        >
          <i className="ti ti-x" />
        </button>

        <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌿</div>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px",
            color: C.espresso,
            margin: "0 0 6px",
          }}
        >
          Continuă cu {PLAN.name}
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: C.warm,
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          Perioada ta gratuită s-a încheiat. Abonează-te ca să continui să
          adaugi contacte, să trimiți mesaje și să construiești oferte.
        </p>

        <div
          style={{
            background: C.cream,
            border: `1px solid ${C.border}`,
            borderRadius: "14px",
            padding: "18px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <span
              style={{ fontSize: "22px", fontWeight: 600, color: C.espresso }}
            >
              {PLAN.priceText}
            </span>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {PLAN.features.map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: C.warm,
                }}
              >
                <i
                  className="ti ti-check"
                  style={{ fontSize: "15px", color: C.green }}
                />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div
            style={{
              background: "#FFF0F4",
              color: "#C94F6A",
              borderRadius: "10px",
              padding: "10px 12px",
              fontSize: "13px",
              marginBottom: "12px",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={() => upgrade(PLAN.id)}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            background: C.sage,
            color: C.white,
            border: "none",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Se deschide..." : "Abonează-te"}
        </button>
        <p
          style={{
            fontSize: "12px",
            color: C.muted,
            textAlign: "center",
            margin: "10px 0 0",
          }}
        >
          Ai un cod de lansare? Îl introduci la pasul de plată.
        </p>
      </div>
    </div>
  );
}
