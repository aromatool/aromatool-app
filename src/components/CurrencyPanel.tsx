import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const ALL_CURRENCIES = ["RON", "EUR", "USD", "GBP", "CHF", "HUF", "PLN", "CZK"];

const CURRENCY_SYMBOLS: Record<string, string> = {
  RON: "RON", EUR: "€", USD: "$", GBP: "£",
  CHF: "CHF", HUF: "Ft", PLN: "zł", CZK: "Kč",
};

export default function CurrencyPanel() {
  const { t: tr } = useTranslation();
  const {
    currency,
    setCurrency,
    customRates = {},
    setCustomRate,
    catalogCurrency,
  } = useCartStore();
  const { isLoading, base, effectiveRate } = useExchangeRates();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState("");
  const [saved, setSaved] = useState(false);
  // Moneda de bază a catalogului curent — cursurile se afișează „față de" ea.
  const baseCurrency = catalogCurrency || base || "EUR";
  const baseSym = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;

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
  // Curs efectiv bază → afișare (câtă monedă de afișare la 1 unitate de bază).
  const displayRate = effectiveRate(baseCurrency, activeCurrency);
  const isCustomActive = ((customRates || {})[activeCurrency] || 0) > 0;

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
          {tr("calculator.currency.toggle")}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.primary }}>
            {CURRENCY_FLAGS[activeCurrency] || ""} {activeCurrency}
          </span>
          {activeCurrency !== baseCurrency && displayRate > 0 && (
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
                <i className="ti ti-pencil" style={{ fontSize: "11px" }} title={tr("calculator.currency.manualRateActive")} />
              )}
              1{baseSym} = {displayRate.toFixed(4)}
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
              {tr("calculator.currency.displayCurrency")}
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
              <span>{tr("calculator.currency.ratesVsBase", { base: baseCurrency })}</span>
              {isLoading ? (
                <span
                  style={{ fontSize: "10px", color: C.muted, fontWeight: 400 }}
                >
                  {tr("calculator.currency.loading")}
                </span>
              ) : (
                <span
                  style={{ fontSize: "10px", color: C.green, fontWeight: 400, display: "flex", alignItems: "center", gap: "3px" }}
                >
                  <i className="ti ti-circle-check-filled" style={{ fontSize: "12px" }} /> {tr("calculator.currency.active")}
                </span>
              )}
            </div>

            {ALL_CURRENCIES.filter((c) => c !== baseCurrency).map((curr) => {
              const safeCustomRates = customRates || {};
              const customRate = safeCustomRates[curr] || 0;
              const hasCustom = customRate > 0;
              // Curs efectiv afișat: câtă `curr` la 1 unitate de bază.
              const activeRate = effectiveRate(baseCurrency, curr);
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
                    {tr(`calculator.currency.names.${curr}`)}
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
                        placeholder={String(activeRate.toFixed(4))}
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
                        title={tr("calculator.currency.save")}
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
                        title={tr("calculator.currency.cancel")}
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
                          {tr("calculator.currency.custom")}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setEditingRate(curr);
                          setRateInput(activeRate > 0 ? activeRate.toFixed(4) : "");
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
                        title={tr("calculator.currency.editRate")}
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
                          title={tr("calculator.currency.resetRate")}
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
                <i className="ti ti-circle-check-filled" style={{ fontSize: "13px" }} /> {tr("calculator.currency.rateSaved")}
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
              {tr("calculator.currency.hintBefore")}
              <i className="ti ti-pencil" style={{ fontSize: "12px" }} />
              {tr("calculator.currency.hintAfter")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
