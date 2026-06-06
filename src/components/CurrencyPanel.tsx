import { useState } from "react";
import { useCartStore } from "../hooks/useCartStore";
import { useExchangeRates } from "../hooks/useExchangeRates";

const C = {
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  border: "rgba(92,122,92,0.15)",
  border2: "rgba(92,122,92,0.25)",
  bg2: "#EEF3EE",
  card: "#FFFFFF",
  green: "#2E8A58",
};

const CURRENCY_FLAGS: Record<string, string> = {
  RON: "🇷🇴",
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  CHF: "🇨🇭",
  HUF: "🇭🇺",
  PLN: "🇵🇱",
  CZK: "🇨🇿",
};

const CURRENCY_NAMES: Record<string, string> = {
  RON: "Leu românesc",
  EUR: "Euro",
  USD: "Dolar american",
  GBP: "Liră sterlină",
  CHF: "Franc elvețian",
  HUF: "Forint",
  PLN: "Zlot polonez",
  CZK: "Coroană cehă",
};

const ALL_CURRENCIES = ["RON", "EUR", "USD", "GBP", "CHF", "HUF", "PLN", "CZK"];

export default function CurrencyPanel() {
  const {
    currency,
    setCurrency,
    customRates = {},
    setCustomRate,
  } = useCartStore();
  const { rates, isLoading } = useExchangeRates();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [saved, setSaved] = useState(false);

  function saveCustomRate(curr: string) {
    const val = parseFloat(rateInput);
    if (val > 0) {
      setCustomRate(curr, val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setEditingRate(null);
    setRateInput("");
  }

  function clearCustomRate(curr: string) {
    setCustomRate(curr, 0);
  }

  const activeCurrency = currency || "RON";
  const activeRate = (customRates || {})[activeCurrency];
  const baseRate = rates[activeCurrency] || 0;
  const displayRate = activeRate && activeRate > 0 ? activeRate : baseRate;
  const isCustomActive = activeRate && activeRate > 0;

  return (
    <div style={{ marginBottom: "8px" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          borderRadius: "10px",
          padding: "10px 14px",
          cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: C.dark,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <i className="ti ti-coins" style={{ fontSize: "15px", color: C.primary }} />
          Monedă & cursuri
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.primary }}>
            {CURRENCY_FLAGS[activeCurrency] || ""} {activeCurrency}
          </span>
          {activeCurrency !== "EUR" && displayRate > 0 && (
            <span
              style={{
                fontSize: "11px",
                color: isCustomActive ? C.primary : C.muted,
                background: isCustomActive ? C.bg2 : "transparent",
                border: isCustomActive ? `1px solid ${C.border2}` : "none",
                borderRadius: "999px",
                padding: isCustomActive ? "1px 7px" : "0",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {isCustomActive && (
                <i className="ti ti-pencil" style={{ fontSize: "11px" }} title="Curs manual activ" />
              )}
              1€ = {displayRate.toFixed(4)}
            </span>
          )}
          <i
            className={isOpen ? "ti ti-chevron-up" : "ti ti-chevron-down"}
            style={{ fontSize: "14px", color: C.muted }}
          />
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            background: C.card,
            border: `1.5px solid ${C.border2}`,
            borderRadius: "12px",
            padding: "16px",
            marginTop: "6px",
          }}
        >
          {/* Currency selector */}
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: C.primary,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "8px",
              }}
            >
              Moneda de afișare
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ALL_CURRENCIES.map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    border: `1.5px solid ${activeCurrency === curr ? C.primary : C.border2}`,
                    background: activeCurrency === curr ? C.primary : C.bg2,
                    color: activeCurrency === curr ? "white" : C.dark,
                    transition: "all 0.15s",
                  }}
                >
                  {CURRENCY_FLAGS[curr]} {curr}
                </button>
              ))}
            </div>
          </div>

          {/* Exchange rates */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: C.primary,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Cursuri față de EUR</span>
              {isLoading ? (
                <span
                  style={{ fontSize: "10px", color: C.muted, fontWeight: 400 }}
                >
                  Se încarcă...
                </span>
              ) : (
                <span
                  style={{ fontSize: "10px", color: C.green, fontWeight: 400, display: "flex", alignItems: "center", gap: "3px" }}
                >
                  <i className="ti ti-circle-check-filled" style={{ fontSize: "12px" }} /> Activ
                </span>
              )}
            </div>

            {ALL_CURRENCIES.filter((c) => c !== "EUR").map((curr) => {
              const baseRate = rates[curr] || 0;
              const safeCustomRates = customRates || {};
              const customRate = safeCustomRates[curr] || 0;
              const hasCustom = customRate > 0;
              const activeRate = hasCustom ? customRate : baseRate;
              const isEditing = editingRate === curr;

              return (
                <div
                  key={curr}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 0",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: C.dark,
                      fontWeight: 500,
                      minWidth: "60px",
                    }}
                  >
                    {CURRENCY_FLAGS[curr]} {curr}
                  </span>
                  <span style={{ fontSize: "11px", color: C.muted, flex: 1 }}>
                    {CURRENCY_NAMES[curr]}
                  </span>

                  {isEditing ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="number"
                        value={rateInput}
                        onChange={(e) => setRateInput(e.target.value)}
                        placeholder={String(baseRate.toFixed(4))}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCustomRate(curr);
                          if (e.key === "Escape") setEditingRate(null);
                        }}
                        style={{
                          width: "80px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          background: C.bg2,
                          border: `1.5px solid ${C.primary}`,
                          borderRadius: "6px",
                          color: C.dark,
                          outline: "none",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      />
                      <button
                        onClick={() => saveCustomRate(curr)}
                        style={{
                          padding: "5px 8px",
                          background: C.primary,
                          border: "none",
                          borderRadius: "6px",
                          color: "white",
                          fontSize: "12px",
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Salvează"
                      >
                        <i className="ti ti-check" />
                      </button>
                      <button
                        onClick={() => setEditingRate(null)}
                        style={{
                          padding: "5px 8px",
                          background: C.bg2,
                          border: `1px solid ${C.border2}`,
                          borderRadius: "6px",
                          color: C.muted,
                          fontSize: "12px",
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Anulează"
                      >
                        <i className="ti ti-x" />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: hasCustom ? C.primary : C.dark,
                        }}
                      >
                        {activeRate > 0 ? activeRate.toFixed(4) : "—"}
                      </span>
                      {hasCustom && (
                        <span
                          style={{
                            fontSize: "9px",
                            color: C.primary,
                            background: C.bg2,
                            padding: "1px 5px",
                            borderRadius: "999px",
                            border: `1px solid ${C.border2}`,
                          }}
                        >
                          custom
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setEditingRate(curr);
                          setRateInput(String(activeRate || ""));
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: C.muted,
                          fontSize: "14px",
                          padding: "2px 4px",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Editează cursul"
                      >
                        <i className="ti ti-pencil" />
                      </button>
                      {hasCustom && (
                        <button
                          onClick={() => clearCustomRate(curr)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: C.muted,
                            fontSize: "14px",
                            padding: "2px 4px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Resetează la cursul implicit"
                        >
                          <i className="ti ti-refresh" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {saved && (
              <div
                style={{ marginTop: "8px", fontSize: "11px", color: C.green, display: "flex", alignItems: "center", gap: "4px" }}
              >
                <i className="ti ti-circle-check-filled" style={{ fontSize: "13px" }} /> Curs salvat!
              </div>
            )}
            <div
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: C.muted,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              Cursuri față de EUR. Apasă
              <i className="ti ti-pencil" style={{ fontSize: "12px" }} />
              pentru a seta un curs manual.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
