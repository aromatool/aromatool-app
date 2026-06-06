import { useState, useMemo, useEffect } from "react";
import { useProducts, useExchangeRate } from "../hooks/useProducts";
import { useCartStore } from "../hooks/useCartStore";
import { useSendEmail } from "../hooks/useSendEmail";
import EnrollLink from "../components/EnrollLink";
import CurrencyPanel from "../components/CurrencyPanel";
import { useExchangeRates } from "../hooks/useExchangeRates";
import type { Product } from "../hooks/useProducts";

// ── COLORS ────────────────────────────────────────────────
const C = {
  bg: "#FDFAFF",
  card: "#FFFFFF",
  border: "rgba(196,168,232,0.3)",
  border2: "rgba(196,168,232,0.5)",
  primary: "#7B5EA7",
  dark: "#2D1A4E",
  muted: "#9B80C4",
  text2: "#6B5B9E",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  bg2: "#F5F0FF",
};

// ── SEARCH SECTION ────────────────────────────────────────
function SearchSection() {
  const [query, setQuery] = useState("");
  const { data: products, isLoading, error } = useProducts();
  const { data: rateData } = useExchangeRate();
  const { addItem, items, setExchangeRate, currency } = useCartStore();
  const { convertFromEur, formatAmount } = useExchangeRates();
  const activeCurrency = currency || "RON";

  // Sync EUR/RON rate from Supabase to store
  useEffect(() => {
    if (rateData?.rate) setExchangeRate(rateData.rate);
  }, [rateData?.rate]);

  const results = useMemo(() => {
    if (!products) return [];
    if (!query.trim()) return products.slice(0, 30);
    const q = query.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.includes(q))
      .slice(0, 20);
  }, [products, query]);

  const inCart = (id: string) => items.some((i) => i.id === id);

  if (isLoading)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px",
          gap: "12px",
        }}
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
        <div style={{ fontSize: "13px", color: C.muted }}>
          Se încarcă produsele...
        </div>
      </div>
    );

  if (error || !products)
    return (
      <div
        style={{
          padding: "20px",
          background: "#FFF0F4",
          border: "1px solid rgba(201,79,106,0.2)",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <div
          style={{ fontSize: "13px", color: "#C94F6A", marginBottom: "8px" }}
        >
          ⚠️ Eroare la încărcarea produselor
        </div>
        <div
          style={{
            fontSize: "11px",
            color: C.muted,
            marginBottom: "12px",
            wordBreak: "break-all",
          }}
        >
          {error ? (error as Error).message : "Date indisponibile"}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#C94F6A",
            border: "none",
            borderRadius: "8px",
            padding: "7px 16px",
            color: "white",
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          🔄 Reîncearcă
        </button>
      </div>
    );

  return (
    <div>
      {/* Search input */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <span
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: C.muted,
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută după nume sau cod..."
          style={{
            width: "100%",
            padding: "11px 40px 11px 38px",
            background: C.card,
            border: `1.5px solid ${C.border2}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              fontSize: "18px",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      <div
        style={{
          border: `1px solid ${C.border2}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {results.length === 0 ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: C.muted,
              fontSize: "13px",
            }}
          >
            Niciun rezultat
          </div>
        ) : (
          results.map((p: Product) => {
            const priceDisplay = convertFromEur(p.price_eur, activeCurrency);
            const added = inCart(p.id);
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 13px",
                  borderBottom: `1px solid ${C.border}`,
                  background: C.card,
                  transition: "background 0.1s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: C.dark,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{ display: "flex", gap: "8px", marginTop: "2px" }}
                  >
                    <span style={{ fontSize: "11px", color: C.muted }}>
                      🏷 {p.sku}
                    </span>
                    <span style={{ fontSize: "11px", color: C.muted }}>
                      ⭐ {p.points} pct
                    </span>
                    <span style={{ fontSize: "11px", color: C.muted }}>
                      € {p.price_eur.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: C.primary,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatAmount(priceDisplay, activeCurrency)}
                  {activeCurrency !== "EUR" && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: C.muted,
                        fontWeight: 400,
                      }}
                    >
                      € {p.price_eur.toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => addItem(p)}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: added ? C.primary : C.bg2,
                    border: `1.5px solid ${added ? C.primary : C.border2}`,
                    color: added ? "white" : C.primary,
                    fontSize: added ? "14px" : "18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {added ? "✓" : "+"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── CART SECTION ──────────────────────────────────────────
function CartSection() {
  const {
    items,
    transport,
    clientName,
    clientEmail,
    clientPhone,
    notes,
    currency,
    prefillContactId,
    removeItem,
    updateQty,
    updateDisc,
    toggleGuide,
    setTransport,
    setClientName,
    setClientEmail,
    setClientPhone,
    setNotes,
    setPrefillContactId,
    clearCart,
    getSubtotalEur,
    getDiscountEur,
    getTotalEur,
    getTotalPoints,
    getCount,
  } = useCartStore();
  const { convertFromEur, formatAmount, getRate } = useExchangeRates();

  const [showCustom, setShowCustom] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [enrollLink, setEnrollLink] = useState("");
  const { addCustomItem } = useCartStore();
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customDisc, setCustomDisc] = useState("");
  const {
    sendOffer,
    loading: sending,
    error: sendError,
    success: sendSuccess,
    setSuccess: setSendSuccess,
  } = useSendEmail();

  const activeCurrency = currency || "RON";

  // Pre-fill contact from Contacts page
  useEffect(() => {
    const prefill = sessionStorage.getItem("prefill_contact");
    if (prefill) {
      try {
        const { id, name, email, phone } = JSON.parse(prefill);
        if (name) setClientName(name);
        if (email) setClientEmail(email);
        if (phone) setClientPhone(phone);
        if (id) setPrefillContactId(id);
        sessionStorage.removeItem("prefill_contact");
      } catch {}
    }
  }, []);

  // All EUR values
  const subtotalEur = getSubtotalEur();
  const discountEur = getDiscountEur();
  const totalEur = getTotalEur();
  const totalPoints = getTotalPoints();
  const count = getCount();

  // Converted to display currency
  const subtotal = convertFromEur(subtotalEur, activeCurrency);
  const discount = convertFromEur(discountEur, activeCurrency);
  const total = convertFromEur(totalEur, activeCurrency);

  if (items.length === 0)
    return (
      <>
        <CurrencyPanel />
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "12px",
            background: C.card,
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>🛒</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "16px",
              color: C.dark,
              marginBottom: "4px",
            }}
          >
            Coșul e gol
          </div>
          <div style={{ fontSize: "13px", color: C.muted }}>
            Caută produse și adaugă-le
          </div>
        </div>
      </>
    );

  return (
    <div>
      {/* Currency panel */}
      <CurrencyPanel />

      {/* Cart items */}
      {items.map((item) => {
        // price_eur is always the source of truth
        const priceEur = item.price_eur;
        const lineTotalEur = priceEur * item.qty * (1 - item.disc / 100);

        // Convert to display currency
        const priceInCurrency = convertFromEur(priceEur, activeCurrency);
        const lineTotalInCurrency = convertFromEur(
          lineTotalEur,
          activeCurrency,
        );
        const showEurSecondary = activeCurrency !== "EUR";
        return (
          <div
            key={item.id}
            style={{
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: "12px",
              padding: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: "13px",
                  fontWeight: 500,
                  color: C.dark,
                  lineHeight: 1.3,
                }}
              >
                {item.name}
              </div>
              <button
                onClick={() => removeItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.muted,
                  fontSize: "16px",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <button
                  onClick={() => updateQty(item.id, item.qty - 1)}
                  style={{
                    width: "26px",
                    height: "26px",
                    background: C.bg2,
                    border: `1px solid ${C.border2}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: C.dark,
                    fontSize: "14px",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: C.dark,
                    minWidth: "20px",
                    textAlign: "center",
                  }}
                >
                  {item.qty}
                </span>
                <button
                  onClick={() => updateQty(item.id, item.qty + 1)}
                  style={{
                    width: "26px",
                    height: "26px",
                    background: C.bg2,
                    border: `1px solid ${C.border2}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: C.dark,
                    fontSize: "14px",
                  }}
                >
                  +
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  marginLeft: "auto",
                }}
              >
                <span style={{ fontSize: "12px", color: C.muted }}>Disc.</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.disc || ""}
                  placeholder="0"
                  onChange={(e) =>
                    updateDisc(item.id, parseFloat(e.target.value) || 0)
                  }
                  style={{
                    width: "50px",
                    background: C.bg2,
                    border: `1px solid ${C.border2}`,
                    borderRadius: "6px",
                    padding: "4px 6px",
                    fontSize: "12px",
                    color: C.dark,
                    fontFamily: "'DM Sans', sans-serif",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "12px", color: C.primary }}>%</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: C.muted }}>
                  {formatAmount(priceInCurrency, activeCurrency)}/buc
                  {item.disc > 0 ? ` · −${item.disc}%` : ""}
                </span>
                {showEurSecondary && (
                  <div style={{ fontSize: "10px", color: C.muted }}>
                    € {priceEur.toFixed(2)}/buc
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: item.disc > 0 ? C.primary : C.dark,
                  }}
                >
                  {formatAmount(lineTotalInCurrency, activeCurrency)}
                </div>
                {showEurSecondary && (
                  <div style={{ fontSize: "10px", color: C.muted }}>
                    € {lineTotalEur.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Transport */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "10px",
          padding: "10px 13px",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "13px", color: C.muted, flex: 1 }}>
          🚚 Cost transport
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={
            transport > 0
              ? parseFloat(convertFromEur(transport, activeCurrency).toFixed(2))
              : ""
          }
          placeholder="0"
          onChange={(e) => {
            const valueInCurrency = parseFloat(e.target.value) || 0;
            // Convert from display currency to EUR for storage
            const valueInEur =
              activeCurrency === "EUR"
                ? valueInCurrency
                : valueInCurrency / (getRate(activeCurrency) || 1);
            setTransport(valueInEur);
          }}
          style={{
            width: "80px",
            background: C.bg2,
            border: `1px solid ${C.border2}`,
            borderRadius: "6px",
            padding: "5px 8px",
            fontSize: "13px",
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            textAlign: "right",
            outline: "none",
          }}
        />
        <span style={{ fontSize: "12px", color: C.muted }}>
          {activeCurrency}
        </span>
        {activeCurrency !== "EUR" && transport > 0 && (
          <span style={{ fontSize: "11px", color: C.muted }}>
            € {transport.toFixed(2)}
          </span>
        )}
      </div>

      {/* Custom product */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        style={{
          width: "100%",
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          borderRadius: "10px",
          padding: "10px",
          color: C.dark,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          marginBottom: "8px",
        }}
      >
        ✨ {showCustom ? "Ascunde" : "Adaugă produs special"}
      </button>

      {showCustom && (
        <div
          style={{
            background: C.card,
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{ fontSize: "11px", color: C.muted, marginBottom: "8px" }}
          >
            Prețul se introduce în <strong>{activeCurrency}</strong> și se
            convertește automat în EUR
          </div>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Numele produsului"
            style={{
              width: "100%",
              marginBottom: "8px",
              padding: "8px 10px",
              background: C.bg2,
              border: `1px solid ${C.border2}`,
              borderRadius: "8px",
              fontSize: "13px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="number"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder={`Preț ${activeCurrency}`}
              style={{
                flex: 1,
                padding: "8px 10px",
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                borderRadius: "8px",
                fontSize: "13px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
            />
            <input
              type="number"
              value={customQty}
              onChange={(e) => setCustomQty(e.target.value)}
              placeholder="Cant."
              min={1}
              style={{
                width: "64px",
                padding: "8px 10px",
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                borderRadius: "8px",
                fontSize: "13px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
            />
            <input
              type="number"
              value={customDisc}
              onChange={(e) => setCustomDisc(e.target.value)}
              placeholder="Disc%"
              style={{
                width: "70px",
                padding: "8px 10px",
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                borderRadius: "8px",
                fontSize: "13px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={() => {
              if (!customName || !customPrice) return;
              const priceInCurrency = parseFloat(customPrice);
              // Convert from selected currency to EUR for storage
              const priceEur =
                activeCurrency === "EUR"
                  ? priceInCurrency
                  : priceInCurrency / (getRate(activeCurrency) || 1);
              addCustomItem(
                customName,
                priceEur,
                parseInt(customQty) || 1,
                parseFloat(customDisc) || 0,
              );
              setCustomName("");
              setCustomPrice("");
              setCustomQty("1");
              setCustomDisc("");
              setShowCustom(false);
            }}
            style={{
              width: "100%",
              marginTop: "8px",
              background: C.primary,
              border: "none",
              borderRadius: "8px",
              padding: "8px",
              color: "white",
              fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            + Adaugă în coș
          </button>
        </div>
      )}

      {/* Guide toggle */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        style={{
          width: "100%",
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          borderRadius: "10px",
          padding: "10px",
          color: C.dark,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          marginBottom: "8px",
        }}
      >
        📖 {showGuide ? "Ascunde ghid" : "Generează ghid produse"}
      </button>

      {showGuide && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border2}`,
            borderRadius: "10px",
            padding: "14px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: C.dark,
              marginBottom: "10px",
            }}
          >
            📖 Ghid produse din coș
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 0",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <input
                type="checkbox"
                checked={item.guideSelected !== false}
                onChange={(e) => toggleGuide(item.id, e.target.checked)}
                style={{
                  accentColor: C.primary,
                  width: "15px",
                  height: "15px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: C.dark,
                  opacity: item.guideSelected !== false ? 1 : 0.4,
                }}
              >
                🌿 {item.name}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "10px",
              paddingTop: "10px",
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: "13px", color: C.text2, flex: 1 }}>
              Trimite ghidul cu oferta
            </span>
            <input
              type="checkbox"
              id="sendGuide"
              defaultChecked
              style={{
                accentColor: C.primary,
                width: "16px",
                height: "16px",
                cursor: "pointer",
              }}
            />
          </div>
        </div>
      )}

      {/* Totals */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "8px",
        }}
      >
        {[
          { label: "Subtotal", value: formatAmount(subtotal, activeCurrency) },
          ...(discountEur > 0
            ? [
                {
                  label: "Reduceri",
                  value: `−${formatAmount(discount, activeCurrency)}`,
                  red: true,
                },
              ]
            : []),
          ...(activeCurrency !== "EUR"
            ? [{ label: "Total Euro", value: `€ ${totalEur.toFixed(2)}` }]
            : []),
          { label: "Puncte ER", value: `${Math.round(totalPoints)} pct` },
          { label: "Produse", value: `${count}` },
          ...(transport > 0
            ? [
                {
                  label: "🚚 Transport",
                  value:
                    activeCurrency !== "EUR"
                      ? `${formatAmount(convertFromEur(transport, activeCurrency), activeCurrency)} · € ${transport.toFixed(2)}`
                      : formatAmount(transport, "EUR"),
                },
              ]
            : []),
        ].map(({ label, value, red }: any) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: `1px solid ${C.border}`,
              fontSize: "13px",
            }}
          >
            <span style={{ color: C.muted }}>{label}</span>
            <span style={{ fontWeight: 600, color: red ? C.red : C.dark }}>
              {value}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: "12px",
            marginTop: "4px",
            borderTop: `1.5px solid ${C.border2}`,
          }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "15px",
              color: C.dark,
            }}
          >
            Total de plată
          </span>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "24px",
                color: C.dark,
                fontWeight: 600,
              }}
            >
              {formatAmount(total, activeCurrency)}
            </div>
            {activeCurrency !== "EUR" && (
              <div style={{ fontSize: "11px", color: C.muted }}>
                € {totalEur.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Send section */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: C.primary,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}
        >
          📧 Trimite oferta clientului
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Numele clientului"
            style={{
              flex: 1,
              padding: "10px 12px",
              background: C.bg2,
              border: `1.5px solid ${C.border2}`,
              borderRadius: "8px",
              fontSize: "14px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <input
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="Telefon"
            style={{
              flex: 1,
              padding: "10px 12px",
              background: C.bg2,
              border: `1.5px solid ${C.border2}`,
              borderRadius: "8px",
              fontSize: "14px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notițe personalizate (opțional)..."
          rows={3}
          style={{
            width: "100%",
            marginBottom: "8px",
            padding: "10px 12px",
            background: C.bg2,
            border: `1.5px solid ${C.border2}`,
            borderRadius: "8px",
            fontSize: "13px",
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="email@client.com"
            style={{
              flex: 1,
              padding: "10px 12px",
              background: C.bg2,
              border: `1.5px solid ${clientEmail.includes("@noemail.local") ? C.red : C.border2}`,
              borderRadius: "8px",
              fontSize: "14px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <button
            disabled={sending}
            onClick={async () => {
              await sendOffer({
                clientName,
                clientEmail,
                clientPhone,
                notes,
                items,
                transport,
                totalDisplay: total,
                totalEur,
                exchangeRate: getRate(activeCurrency),
                currency: activeCurrency,
                contactId: prefillContactId || undefined,
                enrollLink: enrollLink || undefined,
              });
            }}
            style={{
              background: sending ? C.muted : C.primary,
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: sending ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {sending ? "..." : "Trimite"}
          </button>
        </div>

        {clientEmail.includes("@noemail.local") && (
          <div
            style={{
              marginTop: "6px",
              padding: "8px 12px",
              background: "#FFF8E7",
              border: "1px solid rgba(184,134,11,0.3)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#B8860B",
            }}
          >
            ⚠️ Acest contact nu are email. Adaugă un email valid ca să poți
            trimite oferta.
          </div>
        )}

        {sendError && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px 14px",
              background: C.redbg,
              border: `1px solid rgba(201,79,106,0.2)`,
              borderRadius: "8px",
              fontSize: "13px",
              color: C.red,
            }}
          >
            ⚠️ {sendError}
          </div>
        )}

        {sendSuccess && (
          <div
            style={{
              marginTop: "8px",
              padding: "12px 14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: C.green,
                fontWeight: 500,
                marginBottom: "8px",
              }}
            >
              ✅ Email trimis cu succes către {clientEmail}!
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  setClientEmail("");
                  setClientName("");
                  setClientPhone("");
                  setNotes("");
                  clearCart();
                  setSendSuccess(false);
                }}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: C.green,
                  border: "none",
                  borderRadius: "7px",
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                🗑️ Golește coșul
              </button>
              <button
                onClick={() => {
                  setClientEmail("");
                  setClientName("");
                  setClientPhone("");
                  setNotes("");
                  setSendSuccess(false);
                }}
                style={{
                  flex: 1,
                  padding: "7px",
                  background: "white",
                  border: `1px solid rgba(46,138,88,0.3)`,
                  borderRadius: "7px",
                  color: C.green,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                ✉️ Trimite alt email
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp button */}
        {clientPhone && (
          <button
            onClick={() => {
              const waNum = clientPhone
                .replace(/[^0-9]/g, "")
                .replace(/^0/, "40");
              const produse = items
                .map((i) => {
                  const lineTotalEur = i.price_eur * i.qty * (1 - i.disc / 100);
                  const lineTotalDisplay = convertFromEur(
                    lineTotalEur,
                    activeCurrency,
                  );
                  const disc = i.disc > 0 ? ` (-${i.disc}%)` : "";
                  const qty = i.qty > 1 ? ` x${i.qty}` : "";
                  return `• ${i.name}${qty}${disc} — *${formatAmount(lineTotalDisplay, activeCurrency)}*`;
                })
                .join("\n");
              const salut = clientName ? `Bună ${clientName}! 🌿` : "Bună! 🌿";
              let msg = `${salut}\n\nOferta ta personalizată:\n\n${produse}`;
              if (transport > 0)
                msg += `\n\n🚚 Transport: *${formatAmount(convertFromEur(transport, activeCurrency), activeCurrency)}*`;
              msg += `\n${"─".repeat(25)}\n💜 *Total: ${formatAmount(total, activeCurrency)}*`;
              if (notes) msg += `\n\n📝 ${notes}`;
              window.open(
                `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`,
                "_blank",
              );
            }}
            style={{
              width: "100%",
              marginTop: "8px",
              background: "#25D366",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            💬 Trimite pe WhatsApp
          </button>
        )}
      </div>

      {/* Enroll Link */}
      <EnrollLink
        clientName={clientName}
        clientPhone={clientPhone}
        compact={true}
        onLinkGenerated={setEnrollLink}
      />

      {/* Reset */}
      <button
        onClick={clearCart}
        style={{
          width: "100%",
          background: C.redbg,
          border: `1px solid rgba(201,79,106,0.2)`,
          borderRadius: "10px",
          padding: "11px",
          color: C.red,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        🗑️ Golește coșul
      </button>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function CalculatorPage() {
  const { getCount } = useCartStore();
  const count = getCount();
  const [activeTab, setActiveTab] = useState<"search" | "cart">("search");

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Desktop: two columns */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
        className="calculator-desktop"
      >
        {/* Left — Search */}
        <div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "18px",
              color: "#2D1A4E",
              marginBottom: "16px",
            }}
          >
            Caută produse
          </div>
          <SearchSection />
        </div>

        {/* Right — Cart */}
        <div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "18px",
              color: "#2D1A4E",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            Coș
            {count > 0 && (
              <span
                style={{
                  background: "#7B5EA7",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "2px 8px",
                  minWidth: "20px",
                  textAlign: "center",
                }}
              >
                {count}
              </span>
            )}
          </div>
          <CartSection />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="calculator-mobile">
        <div
          style={{
            display: "flex",
            background: "#F5F0FF",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
          }}
        >
          {[
            { key: "search", label: "🔍 Caută" },
            { key: "cart", label: `🛒 Coș${count > 0 ? ` (${count})` : ""}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1,
                padding: "9px",
                border: "none",
                borderRadius: "9px",
                background: activeTab === tab.key ? "white" : "transparent",
                color: activeTab === tab.key ? "#2D1A4E" : "#9B80C4",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow:
                  activeTab === tab.key
                    ? "0 1px 6px rgba(123,94,167,0.15)"
                    : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "search" ? <SearchSection /> : <CartSection />}
      </div>

      <style>{`
        @media (min-width: 769px) { .calculator-mobile { display: none; } }
        @media (max-width: 768px) { .calculator-desktop { display: none !important; } }
      `}</style>
    </div>
  );
}
