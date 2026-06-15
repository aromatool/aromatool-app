import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { useUpgrade } from "../hooks/useUpgrade";
import RedeemCodeForm from "../components/RedeemCodeForm";

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
  countryCode: string; // țara liderului (catalog implicit pentru oferte)
  renewsAt: Date | null; // finalul perioadei curente (reînnoire sau expirare)
  cancelAtPeriodEnd: boolean; // abonamentul se anulează la finalul perioadei
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
  const { user, loading: authLoading } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [freeAccess, setFreeAccess] = useState(false);
  const [countryCode, setCountryCode] = useState("RO");
  const [renewsAt, setRenewsAt] = useState<Date | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPlan(null);
      setStatus(null);
      setTrialEndsAt(null);
      setIsAdmin(false);
      setFreeAccess(false);
      setCountryCode("RO");
      setRenewsAt(null);
      setCancelAtPeriodEnd(false);
      // ATENȚIE: nu concluziona „fără acces" cât timp AUTH încă se încarcă.
      // La un refresh de pagină, user e null o clipă până se rezolvă sesiunea;
      // dacă am pune loading=false aici, hasAccess ar deveni fals pentru un
      // moment → CalculatorPage ar deschide paywall-ul degeaba (chiar și pentru
      // admin). Rămânem în loading până auth confirmă că nu există user.
      setLoading(authLoading);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "subscription_plan, subscription_status, trial_ends_at, is_admin, free_access, country_code, subscription_current_period_end, subscription_cancel_at_period_end",
      )
      .eq("id", user.id)
      .single();
    setPlan(data?.subscription_plan ?? null);
    setStatus(data?.subscription_status ?? null);
    setTrialEndsAt(data?.trial_ends_at ? new Date(data.trial_ends_at) : null);
    setIsAdmin(data?.is_admin ?? false);
    setFreeAccess(data?.free_access ?? false);
    setCountryCode(data?.country_code ?? "RO");
    setRenewsAt(
      data?.subscription_current_period_end
        ? new Date(data.subscription_current_period_end)
        : null,
    );
    setCancelAtPeriodEnd(data?.subscription_cancel_at_period_end ?? false);
    setLoading(false);
  }, [user?.id, authLoading]);

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
    countryCode,
    renewsAt,
    cancelAtPeriodEnd,
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

// Țara → valuta de afișare. RO=RON, restul (UE) implicit EUR.
function currencyForCountry(country: string): string {
  return country === "RO" ? "ron" : "eur";
}

type PlanPrice = {
  configured: boolean;
  interval?: string;
  currencies?: Record<string, { amount: number }>;
};

function Paywall({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { upgrade, loading, error } = useUpgrade();
  const { countryCode } = useSubscription();
  const planName = t("paywall.planName");
  const features = t("paywall.features", { returnObjects: true }) as string[];

  // ── Preț live din Stripe (Approach A) ──────────────────────
  // Citim prețul real din Stripe și alegem valuta după țara liderului.
  // Dacă funcția nu e configurată / eșuează, cădem pe textul static.
  const [price, setPrice] = useState<PlanPrice | null>(null);
  const [priceLoaded, setPriceLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke("get-plan-price")
      .then(({ data }) => {
        if (active && data) setPrice(data as PlanPrice);
      })
      .catch(() => {
        /* fallback la priceText static */
      })
      .finally(() => {
        if (active) setPriceLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Cât timp se încarcă prețul live, nu afișăm fallback-ul static
  // (altfel apare un flash "99 RON" până vine prețul real din Stripe).
  const priceLabel = (() => {
    if (!priceLoaded) return null;
    if (!price?.configured || !price.currencies) return t("paywall.priceText");
    const wanted = currencyForCountry(countryCode);
    const entry =
      price.currencies[wanted] ??
      price.currencies["eur"] ??
      price.currencies["ron"] ??
      Object.values(price.currencies)[0];
    if (!entry) return t("paywall.priceText");
    const cur =
      price.currencies[wanted] ? wanted : Object.keys(price.currencies)[0];
    const value = entry.amount / 100;
    let formatted: string;
    try {
      formatted = new Intl.NumberFormat(i18n.language || "ro", {
        style: "currency",
        currency: cur.toUpperCase(),
        minimumFractionDigits: entry.amount % 100 === 0 ? 0 : 2,
      }).format(value);
    } catch {
      formatted = `${value} ${cur.toUpperCase()}`;
    }
    const per =
      price.interval === "year" ? t("paywall.perYear") : t("paywall.perMonth");
    return `${formatted} ${per}`;
  })();

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
          aria-label={t("common.close")}
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
          {t("paywall.continueWith", { plan: planName })}
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: C.warm,
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          {t("paywall.trialEndedBody")}
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
            {priceLabel === null ? (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "120px",
                  height: "22px",
                  borderRadius: "6px",
                  background: "rgba(61,53,48,0.10)",
                }}
              />
            ) : (
              <span
                style={{ fontSize: "22px", fontWeight: 600, color: C.espresso }}
              >
                {priceLabel}
              </span>
            )}
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
            {features.map((f) => (
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
          {loading ? t("paywall.opening") : t("paywall.subscribe")}
        </button>
        <div
          style={{
            marginTop: "20px",
            paddingTop: "18px",
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.espresso,
              margin: "0 0 8px",
            }}
          >
            {t("promo.redeem.title")}
          </p>
          <RedeemCodeForm onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
