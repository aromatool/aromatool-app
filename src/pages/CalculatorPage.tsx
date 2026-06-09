import { useState, useMemo, useEffect } from "react";
import { useProducts, useExchangeRate } from "../hooks/useProducts";
import { useCartStore } from "../hooks/useCartStore";
import { useSendEmail, buildEmailHtml } from "../hooks/useSendEmail";
import { useResources } from "../hooks/useResources";
import EnrollLink from "../components/EnrollLink";
import CurrencyPanel from "../components/CurrencyPanel";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useAuth } from "../lib/auth";
import { useSubscription } from "../lib/subscription";
import type { Product } from "../hooks/useProducts";

// ── BLOSSOM SAGE COLORS ───────────────────────────────────
const C = {
  bg: "#FAFAF7",
  card: "#FFFFFF",
  border: "rgba(92,122,92,0.15)",
  border2: "rgba(92,122,92,0.25)",
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  text2: "#6A5A50",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  bg2: "#E8F0E8",
  amber: "#C4906A",
  amberbg: "#FDF5EE",
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
            border: `3px solid ${C.bg2}`,
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
          background: C.redbg,
          border: "1px solid rgba(201,79,106,0.2)",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <i
          className="ti ti-alert-triangle"
          style={{ fontSize: "20px", color: C.red, display: "block", marginBottom: "6px" }}
        />
        <div style={{ fontSize: "13px", color: C.red, marginBottom: "8px" }}>
          Eroare la încărcarea produselor
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
            background: C.red,
            border: "none",
            borderRadius: "8px",
            padding: "7px 16px",
            color: "white",
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Reîncearcă
        </button>
      </div>
    );

  return (
    <div>
      {/* Search input */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: C.muted,
          }}
        />
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
              display: "flex",
              alignItems: "center",
              padding: "2px",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: "16px" }} />
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
                    style={{ display: "flex", gap: "8px", marginTop: "3px", alignItems: "center" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", color: C.muted }}>
                      <i className="ti ti-tag" style={{ fontSize: "11px" }} />
                      {p.sku}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", color: C.muted }}>
                      <i className="ti ti-star" style={{ fontSize: "11px" }} />
                      {p.points} pct
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
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {added
                    ? <i className="ti ti-check" style={{ fontSize: "14px" }} />
                    : <i className="ti ti-plus" style={{ fontSize: "16px" }} />
                  }
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
  const [enrollLink, setEnrollLink] = useState("");
  const [successEmail, setSuccessEmail] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showOfferText, setShowOfferText] = useState(false);
  const [offerTextCopied, setOfferTextCopied] = useState(false);
  const [offerText, setOfferText] = useState("");
  const { addCustomItem } = useCartStore();
  const { user } = useAuth();
  const { requireAccess } = useSubscription();
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customDisc, setCustomDisc] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const { resources } = useResources();
  const {
    sendOffer,
    loading: sending,
    error: sendError,
    success: sendSuccess,
    setSuccess: setSendSuccess,
  } = useSendEmail();

  // Banner-ul de succes dispare automat după câteva secunde
  useEffect(() => {
    if (!sendSuccess) return;
    const t = setTimeout(() => setSendSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [sendSuccess, setSendSuccess]);

  const activeCurrency = currency || "RON";

  // Prefill-ul e gestionat în CalculatorPage (mai sus) — nu mai e nevoie aici

  // All EUR values
  const subtotalEur = getSubtotalEur();
  const discountEur = getDiscountEur();
  const totalEur = getTotalEur();
  const totalPoints = getTotalPoints();
  const count = getCount();

  // Text ofertă formatat — copiabil, de folosit pe orice canal (WhatsApp, SMS, Messenger etc.)
  function buildOfferText(): string {
    const produse = items
      .map((i) => {
        const lineTotalEur = i.price_eur * i.qty * (1 - i.disc / 100);
        const lineTotalDisplay = convertFromEur(lineTotalEur, activeCurrency);
        const disc = i.disc > 0 ? ` (-${i.disc}%)` : "";
        const qty = i.qty > 1 ? ` x${i.qty}` : "";
        return `• ${i.name}${qty}${disc} — ${formatAmount(lineTotalDisplay, activeCurrency)}`;
      })
      .join("\n");
    const salut = clientName ? `Bună ${clientName}! 🌿` : "Bună! 🌿";
    let msg = `${salut}\n\nOferta ta personalizată:\n\n${produse}`;
    if (transport > 0)
      msg += `\n\n🚚 Transport: ${formatAmount(convertFromEur(transport, activeCurrency), activeCurrency)}`;
    msg += `\n${"─".repeat(25)}\n💚 Total: ${formatAmount(total, activeCurrency)}`;
    if (notes) msg += `\n\n📝 ${notes}`;
    if (enrollLink)
      msg += `\n\n🔗 Link înscriere Young Living:\n${enrollLink}`;
    return msg;
  }

  function copyOfferText() {
    navigator.clipboard.writeText(offerText);
    setOfferTextCopied(true);
    setTimeout(() => setOfferTextCopied(false), 2000);
  }

  // Deschide WhatsApp cu textul ofertei precompletat.
  // Dacă avem telefonul clientului, deschide direct conversația cu el.
  function sendOfferWhatsApp() {
    if (!requireAccess()) return;
    const text = encodeURIComponent(offerText || buildOfferText());
    const digits = clientPhone
      ? clientPhone.replace(/[^0-9]/g, "").replace(/^0/, "40")
      : "";
    const url = digits
      ? `https://wa.me/${digits}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener");
  }

  // ── Resurse: selectare din biblioteca userului, trimise ca linkuri ──
  function toggleResource(id: string) {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleOfferText() {
    if (!showOfferText) {
      // La deschidere populăm textarea cu textul generat din coș
      setOfferText(buildOfferText());
      setShowOfferText(true);
    } else {
      setShowOfferText(false);
    }
  }

  // Converted to display currency
  const subtotal = convertFromEur(subtotalEur, activeCurrency);
  const discount = convertFromEur(discountEur, activeCurrency);
  const total = convertFromEur(totalEur, activeCurrency);

  if (items.length === 0)
    return (
      <>
        <CurrencyPanel />
        {sendSuccess && (
          <div
            style={{
              marginBottom: "12px",
              padding: "14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "13px",
              color: C.green,
              fontWeight: 600,
            }}
          >
            <i className="ti ti-circle-check" style={{ fontSize: "18px" }} />
            Oferta a fost trimisă către {successEmail}!
          </div>
        )}
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "12px",
            background: C.card,
          }}
        >
          <i
            className="ti ti-shopping-cart"
            style={{ fontSize: "32px", color: C.muted, display: "block", marginBottom: "10px" }}
          />
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
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
        const priceEur = item.price_eur;
        const lineTotalEur = priceEur * item.qty * (1 - item.disc / 100);
        const priceInCurrency = convertFromEur(priceEur, activeCurrency);
        const lineTotalInCurrency = convertFromEur(lineTotalEur, activeCurrency);
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
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <i className="ti ti-x" style={{ fontSize: "16px" }} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
        <i className="ti ti-truck" style={{ fontSize: "15px", color: C.muted }} />
        <span style={{ fontSize: "13px", color: C.muted, flex: 1 }}>
          Cost transport
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <i className={`ti ti-${showCustom ? "chevron-up" : "plus"}`} style={{ fontSize: "14px" }} />
        {showCustom ? "Ascunde" : "Adaugă produs special"}
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
            Adaugă un produs care nu e în listă — introdu prețul în{" "}
            <strong>{activeCurrency}</strong>
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: "14px" }} />
            Adaugă în coș
          </button>
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
                  label: "Transport",
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
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: "15px",
              color: C.dark,
            }}
          >
            Total de plată
          </span>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "24px",
                color: C.dark,
                fontWeight: 700,
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
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "10px",
            fontWeight: 700,
            color: C.primary,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "10px",
          }}
        >
          <i className="ti ti-mail" style={{ fontSize: "13px" }} />
          Trimite oferta clientului
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

        {/* Resurse atașate (ca linkuri securizate) */}
        <div style={{ marginBottom: "8px" }}>
          <button
            onClick={() => setShowResourcePicker((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: C.bg2,
              border: `1.5px dashed ${C.border2}`,
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 500,
              color: C.text2,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <i className="ti ti-paperclip" style={{ fontSize: "14px" }} />
            + Adaugă resursă
            {selectedResourceIds.length > 0 && ` (${selectedResourceIds.length})`}
          </button>

          {showResourcePicker && (
            <div
              style={{
                marginTop: "8px",
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                padding: "10px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {resources.length === 0 ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: C.muted,
                    textAlign: "center",
                    padding: "12px",
                  }}
                >
                  Nu ai resurse încă. Adaugă-le din pagina „Resurse".
                </div>
              ) : (
                resources.map((r) => {
                  const checked = selectedResourceIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 4px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleResource(r.id)}
                        style={{
                          accentColor: C.primary,
                          width: "15px",
                          height: "15px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      <i
                        className={
                          r.file_type === "application/pdf"
                            ? "ti ti-file-type-pdf"
                            : "ti ti-photo"
                        }
                        style={{ fontSize: "15px", color: C.primary, flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          color: C.dark,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.title}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          )}

          {selectedResourceIds.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginTop: "8px",
              }}
            >
              {selectedResourceIds.map((id) => {
                const r = resources.find((x) => x.id === id);
                if (!r) return null;
                return (
                  <div
                    key={id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 8px",
                      background: C.bg2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: C.dark,
                    }}
                  >
                    <i
                      className={
                        r.file_type === "application/pdf"
                          ? "ti ti-file-type-pdf"
                          : "ti ti-photo"
                      }
                      style={{ fontSize: "13px", color: C.primary, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "160px",
                      }}
                    >
                      {r.title}
                    </span>
                    <button
                      onClick={() => toggleResource(id)}
                      title="Elimină"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.muted,
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      <i className="ti ti-x" style={{ fontSize: "13px" }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
              const emailSentTo = clientEmail;
              const ok = await sendOffer({
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
                resourceIds: selectedResourceIds.length > 0 ? selectedResourceIds : undefined,
              });
              if (ok) {
                // Golire automată după trimitere reușită
                setSuccessEmail(emailSentTo);
                clearCart();
                setClientName("");
                setClientEmail("");
                setClientPhone("");
                setNotes("");
                setPrefillContactId(null);
                setSelectedResourceIds([]);
                setShowResourcePicker(false);
              }
            }}
            style={{
              background: sending ? C.muted : C.primary,
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sending ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {sending
              ? <><i className="ti ti-loader-2" style={{ fontSize: "14px" }} /> Se trimite...</>
              : <><i className="ti ti-send" style={{ fontSize: "14px" }} /> Trimite</>
            }
          </button>
        </div>

        {/* Preview email — sub câmpul de email */}
        <button
          onClick={() => setShowPreview(true)}
          disabled={items.length === 0}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px 2px",
            fontSize: "12px",
            color: items.length === 0 ? C.muted : C.text2,
            cursor: items.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "'DM Sans', sans-serif",
            marginTop: "2px",
            width: "100%",
            justifyContent: "center",
            textDecoration: items.length === 0 ? "none" : "underline",
            textUnderlineOffset: "3px",
          }}
        >
          <i className="ti ti-eye" style={{ fontSize: "14px" }} />
          Previzualizează emailul înainte de trimitere
        </button>

        {clientEmail.includes("@noemail.local") && (
          <div
            style={{
              marginTop: "6px",
              padding: "8px 12px",
              background: C.amberbg,
              border: `1px solid rgba(196,144,106,0.3)`,
              borderRadius: "8px",
              fontSize: "12px",
              color: C.amber,
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
            }}
          >
            <i className="ti ti-alert-triangle" style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }} />
            Acest contact nu are email. Adaugă un email valid ca să poți trimite oferta.
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
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
            }}
          >
            <i className="ti ti-alert-circle" style={{ fontSize: "15px", flexShrink: 0, marginTop: "1px" }} />
            {sendError}
          </div>
        )}

        {sendSuccess && (
          <div
            style={{
              marginTop: "8px",
              padding: "14px",
              background: C.greenbg,
              border: `1px solid rgba(46,138,88,0.2)`,
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                fontSize: "13px",
                color: C.green,
                fontWeight: 600,
                marginBottom: "12px",
              }}
            >
              <i className="ti ti-circle-check" style={{ fontSize: "18px" }} />
              Oferta a fost trimisă către {successEmail || clientEmail}!
            </div>
            <button
              onClick={() => setSendSuccess(false)}
              style={{
                width: "100%",
                padding: "9px",
                background: C.green,
                border: "none",
                borderRadius: "8px",
                color: "white",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: "14px" }} />
              Creează ofertă nouă
            </button>
          </div>
        )}

        {/* Link înscriere — se include în email */}
        <div style={{ marginTop: "8px" }}>
          <EnrollLink
            clientName={clientName}
            clientPhone={clientPhone}
            compact={true}
            onLinkGenerated={setEnrollLink}
          />
        </div>
      </div>

      {/* Text ofertă copiabil — de folosit pe orice canal (în afara emailului) */}
        <button
          onClick={toggleOfferText}
          disabled={items.length === 0}
          style={{
            width: "100%",
            marginTop: "8px",
            background: showOfferText ? C.bg2 : C.card,
            border: `1px solid ${C.border2}`,
            borderRadius: "10px",
            padding: "11px",
            color: items.length === 0 ? C.muted : C.primary,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            cursor: items.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
          }}
        >
          <i className="ti ti-message-2-share" style={{ fontSize: "15px" }} />
          Oferta ca mesaj text
          <i
            className={showOfferText ? "ti ti-chevron-up" : "ti ti-chevron-down"}
            style={{ fontSize: "14px", marginLeft: "auto", opacity: 0.6 }}
          />
        </button>

        {showOfferText && items.length > 0 && (
          <div
            style={{
              marginTop: "6px",
              background: C.card,
              border: `1.5px dashed ${C.border2}`,
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: C.primary,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Editează, apoi copiază pe orice canal
              </span>
              <button
                onClick={() => setOfferText(buildOfferText())}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "11px",
                  color: C.text2,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                <i className="ti ti-refresh" style={{ fontSize: "13px" }} />
                Regenerează din coș
              </button>
            </div>
            <textarea
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              rows={10}
              style={{
                width: "100%",
                boxSizing: "border-box",
                margin: 0,
                marginBottom: "10px",
                padding: "10px 12px",
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                borderRadius: "8px",
                fontSize: "12px",
                lineHeight: 1.55,
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                resize: "vertical",
                maxHeight: "320px",
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={copyOfferText}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: offerTextCopied ? C.greenbg : C.primary,
                  border: offerTextCopied ? `1px solid ${C.green}` : "none",
                  borderRadius: "9px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: offerTextCopied ? C.green : "white",
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <i
                  className={offerTextCopied ? "ti ti-check" : "ti ti-copy"}
                  style={{ fontSize: "15px" }}
                />
                {offerTextCopied ? "Text copiat!" : "Copiază textul ofertei"}
              </button>
              <button
                onClick={sendOfferWhatsApp}
                title="Trimite pe WhatsApp"
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#25D366",
                  border: "none",
                  borderRadius: "9px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <i className="ti ti-brand-whatsapp" style={{ fontSize: "16px" }} />
                WhatsApp
              </button>
            </div>
          </div>
        )}

      {/* Reset */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "16px",
          borderTop: `1px solid ${C.border2}`,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          onClick={clearCart}
          style={{
            background: "transparent",
            border: "none",
            padding: "6px 10px",
            color: C.muted,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
        >
          <i className="ti ti-trash" style={{ fontSize: "14px" }} />
          Golește coșul
        </button>
      </div>

      {/* ── MODAL PREVIEW EMAIL ─────────────────────────── */}
      {showPreview && (() => {
        const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'AromaTool';
        const userPhone = user?.user_metadata?.phone || '';
        const userEmail = user?.user_metadata?.contact_email || user?.email || '';
        const userSignature = user?.user_metadata?.email_signature || '';
        // Resursele selectate, ca butoane în preview (URL placeholder — linkurile reale
        // cu token se generează la trimitere).
        const previewResourceLinks = selectedResourceIds
          .map((id) => resources.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
          .map((r) => ({ title: r.title, url: '#' }));
        const previewHtml = buildEmailHtml(
          {
            clientName,
            clientEmail: clientEmail || 'preview@example.com',
            clientPhone,
            notes,
            items,
            transport,
            totalDisplay: total,
            totalEur,
            exchangeRate: getRate(activeCurrency),
            currency: activeCurrency,
            enrollLink: enrollLink || undefined,
          },
          userName,
          userPhone,
          userEmail,
          previewResourceLinks,
          userSignature,
        );
        return (
          <div
            onClick={() => setShowPreview(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(61,53,48,0.55)',
              backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', padding: '20px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '580px',
                display: 'flex', flexDirection: 'column',
                height: '100%', maxHeight: 'calc(100vh - 40px)',
              }}
            >
              {/* Header modal */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-eye" style={{ fontSize: '18px', color: 'white' }} />
                  <span style={{ color: 'white', fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600 }}>
                    Preview email ofertă
                  </span>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none',
                    borderRadius: '8px', padding: '6px 12px',
                    color: 'white', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: '14px' }} />
                  Închide
                </button>
              </div>
              {/* Iframe email */}
              <iframe
                srcDoc={previewHtml}
                title="Preview email"
                style={{
                  flex: 1, border: 'none',
                  borderRadius: '16px',
                  background: '#F2F5F0',
                  width: '100%',
                }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function CalculatorPage() {
  const {
    getCount, items, clientName, clearCart,
    setClientName, setClientEmail, setClientPhone, setPrefillContactId,
  } = useCartStore();
  const count = getCount();
  const [activeTab, setActiveTab] = useState<"search" | "cart">("search");

  // Banner "Ofertă în curs" — apare dacă coșul era plin și NU vine dintr-un contact
  const [showDraftBanner, setShowDraftBanner] = useState<boolean>(() => {
    if (items.length === 0) return false;
    if (sessionStorage.getItem("prefill_contact")) return false;
    return true;
  });

  // Prefill contact — GOLEŞTE coşul şi setează noul client
  useEffect(() => {
    const raw = sessionStorage.getItem("prefill_contact");
    if (!raw) return;
    try {
      const { id, name, email, phone } = JSON.parse(raw);
      clearCart();
      if (name) setClientName(name);
      if (email && !email.includes("@noemail.local")) setClientEmail(email);
      if (phone) setClientPhone(phone);
      if (id) setPrefillContactId(id);
      sessionStorage.removeItem("prefill_contact");
      setActiveTab("cart"); // pe mobil, deschide direct coșul
      setShowDraftBanner(false);
    } catch {
      sessionStorage.removeItem("prefill_contact");
    }
  }, []);

  const handleContinueDraft = () => setShowDraftBanner(false);

  const handleNewOffer = () => {
    clearCart();
    setShowDraftBanner(false);
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* BANNER OFERTĂ ÎN CURS */}
      {showDraftBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: C.amberbg,
            border: `1px solid rgba(196,144,106,0.35)`,
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <i className="ti ti-shopping-cart" style={{ fontSize: 18, color: C.amber, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>
              Ai o ofertă în curs —{" "}
              {count} {count === 1 ? "produs" : "produse"}
              {clientName ? ` pentru ${clientName}` : ""}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Continuă de unde ai rămas sau începe o ofertă nouă.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleContinueDraft}
              style={{
                padding: "8px 16px",
                background: C.amber,
                border: "none",
                borderRadius: 8,
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="ti ti-arrow-right" style={{ fontSize: 14 }} />
              Continuă oferta
            </button>
            <button
              onClick={handleNewOffer}
              style={{
                padding: "8px 16px",
                background: C.card,
                border: `1px solid rgba(196,144,106,0.35)`,
                borderRadius: 8,
                color: C.muted,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 14 }} />
              Ofertă nouă
            </button>
          </div>
        </div>
      )}

      {/* Desktop: two columns */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
        className="calculator-desktop"
      >
        {/* Left — Search */}
        <div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: "17px",
              color: C.dark,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <i className="ti ti-search" style={{ fontSize: "17px", color: C.primary }} />
            Caută produse
          </div>
          <SearchSection />
        </div>

        {/* Right — Cart */}
        <div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: "17px",
              color: C.dark,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <i className="ti ti-shopping-cart" style={{ fontSize: "17px", color: C.primary }} />
            Coș
            {count > 0 && (
              <span
                style={{
                  background: C.primary,
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
            background: C.bg2,
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "16px",
          }}
        >
          {[
            {
              key: "search",
              icon: "ti-search",
              label: "Caută",
            },
            {
              key: "cart",
              icon: "ti-shopping-cart",
              label: `Coș${count > 0 ? ` (${count})` : ""}`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "search" | "cart")}
              style={{
                flex: 1,
                padding: "9px",
                border: "none",
                borderRadius: "9px",
                background: activeTab === tab.key ? "white" : "transparent",
                color: activeTab === tab.key ? C.dark : C.muted,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                boxShadow:
                  activeTab === tab.key
                    ? "0 1px 6px rgba(92,122,92,0.15)"
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: "14px" }} />
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
