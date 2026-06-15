import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useSubscription } from "../lib/subscription";

// ============================================================
// REDEEM CODE — câmp „Introdu cod" refolosibil.
// Apelează RPC-ul redeem_promo_code (extinde trial-ul), apoi
// reîmprospătează starea de abonament. Mesajele vin din i18n
// (promo.redeem.*), mapate după statusul întors de RPC.
// ============================================================

const C = {
  sage: "#5C7A5C",
  border: "rgba(92,122,92,0.25)",
  dark: "#3D3530",
  muted: "#A89888",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  white: "#FFFFFF",
};

type Status =
  | "ok"
  | "not_found"
  | "inactive"
  | "expired"
  | "exhausted"
  | "already"
  | "error";

export default function RedeemCodeForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const { refresh } = useSubscription();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: Status; days?: number } | null>(
    null,
  );

  async function submit() {
    const value = code.trim();
    if (!value || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: value,
      });
      if (error) throw error;
      const status = (data?.status ?? "error") as Status;
      const days = data?.days as number | undefined;
      setResult({ status, days });
      if (status === "ok") {
        setCode("");
        await refresh();
        onSuccess?.();
      }
    } catch {
      setResult({ status: "error" });
    } finally {
      setLoading(false);
    }
  }

  const isOk = result?.status === "ok";
  const message = result
    ? isOk
      ? t("promo.redeem.ok", { days: result.days })
      : t(`promo.redeem.${result.status}`)
    : "";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("promo.redeem.placeholder")}
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "10px 12px",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            fontSize: 14,
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: "0.04em",
            outline: "none",
            background: C.white,
          }}
        />
        <button
          onClick={submit}
          disabled={loading || !code.trim()}
          style={{
            padding: "10px 18px",
            background: C.sage,
            color: C.white,
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !code.trim() ? "default" : "pointer",
            opacity: loading || !code.trim() ? 0.6 : 1,
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? t("promo.redeem.applying") : t("promo.redeem.button")}
        </button>
      </div>
      {message && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            background: isOk ? C.greenbg : C.redbg,
            color: isOk ? C.green : C.red,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
