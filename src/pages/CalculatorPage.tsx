import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { useProducts, useExchangeRate, useProductCountries } from "../hooks/useProducts";
import { useCartStore, priceFor } from "../hooks/useCartStore";
import { useSendEmail, buildEmailHtml, round2, computeOfferTotals } from "../hooks/useSendEmail";
import { useResources } from "../hooks/useResources";
import { useProductDescriptions } from "../hooks/useProductDescriptions";
import EnrollLink from "../components/EnrollLink";
import PhoneInput from "../components/PhoneInput";
import CurrencyPanel from "../components/CurrencyPanel";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useAuth } from "../lib/auth";
import { useSubscription } from "../lib/subscription";
import { normalizePhone } from "../lib/contactActions";
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
  const { t: tr } = useTranslation();
  const [query, setQuery] = useState("");
  const catalogCountry = useCartStore((s) => s.catalogCountry);
  const { data: products, isLoading, error } = useProducts(catalogCountry);
  const { data: rateData } = useExchangeRate();
  const { addItem, items, setExchangeRate, currency, catalogCurrency, setCatalogCurrency, priceMode, setPriceMode } = useCartStore();
  const { convertFromBase, formatAmount } = useExchangeRates();
  const activeCurrency = currency || "RON";

  // Sync EUR/RON rate from Supabase to store
  useEffect(() => {
    if (rateData?.rate) setExchangeRate(rateData.rate);
  }, [rateData?.rate]);

  // Sincronizează moneda de bază a catalogului din produsele încărcate, chiar
  // ÎNAINTE de a adăuga ceva în coș. Altfel, cu coșul gol, baza rămâne pe
  // default (EUR) iar cursul manual (ancorat la moneda catalogului) nu s-ar
  // reflecta în lista de produse. Doar când coșul e gol — la coș plin baza e
  // deja fixată de addItem și nu o suprascriem (nu amestecăm cataloage).
  useEffect(() => {
    if (products && products.length > 0 && items.length === 0) {
      const c = products[0].currency || "EUR";
      if (c !== catalogCurrency) setCatalogCurrency(c);
    }
  }, [products, items.length, catalogCurrency, setCatalogCurrency]);

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
          {tr("calculator.loadingProducts")}
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
          {tr("calculator.loadError")}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: C.muted,
            marginBottom: "12px",
            wordBreak: "break-all",
          }}
        >
          {error ? (error as Error).message : tr("calculator.dataUnavailable")}
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
          {tr("calculator.retry")}
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
          placeholder={tr("calculator.searchPlaceholder")}
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

      {/* Selector preț: Angro / Retail — vizibil, controlează ce preț apare
          în listă, în coș și în oferta trimisă. Implicit Angro. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "12px", color: C.muted, fontWeight: 500 }}>
          {tr("calculator.priceMode.label")}
        </span>
        <div
          style={{
            display: "inline-flex",
            background: C.bg2,
            border: `1px solid ${C.border2}`,
            borderRadius: "9px",
            padding: "2px",
          }}
        >
          {(["wholesale", "retail"] as const).map((m) => {
            const active = priceMode === m;
            return (
              <button
                key={m}
                onClick={() => setPriceMode(m)}
                title={tr(`calculator.priceMode.${m}Hint`)}
                style={{
                  border: "none",
                  borderRadius: "7px",
                  padding: "5px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  background: active ? C.primary : "transparent",
                  color: active ? "white" : C.muted,
                  transition: "all 0.15s",
                }}
              >
                {tr(`calculator.priceMode.${m}`)}
              </button>
            );
          })}
        </div>
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
            {tr("calculator.noResults")}
          </div>
        ) : (
          results.map((p: Product) => {
            // Moneda de bază = moneda nativă a produsului (EUR, GBP, ...).
            const base = p.currency || "EUR";
            // Prețul afișat depinde de modul selectat (angro / retail).
            const activePrice = priceFor(p, priceMode);
            const priceDisplay = convertFromBase(activePrice, base, activeCurrency);
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
                      {p.points} {tr("calculator.points")}
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
                  {activeCurrency !== base && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: C.muted,
                        fontWeight: 400,
                      }}
                    >
                      {formatAmount(activePrice, base)}
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
  const { t: tr } = useTranslation();
  const {
    items,
    transport,
    clientName,
    clientEmail,
    clientPhone,
    notes,
    currency,
    catalogCountry,
    catalogCurrency,
    prefillContactId,
    offerLang: storeOfferLang,
    priceMode,
    setOfferLang,
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
  const { convertFromBase, formatAmount, effectiveRate } = useExchangeRates();
  // Moneda de bază a ofertei (în care sunt stocate prețurile `price_eur`).
  const baseCurrency = catalogCurrency || "EUR";

  // Descrieri de produse (bibliotecă) + ce sku-uri sunt bifate să apară în
  // email. Bifa e per-ofertă (state local), nu se persistă.
  const { descriptions } = useProductDescriptions();
  const [includedDescSkus, setIncludedDescSkus] = useState<Set<string>>(new Set());
  const toggleDesc = (sku: string) =>
    setIncludedDescSkus((prev) => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });

  // Articole cu prețul „rezolvat" pe modul selectat (angro / retail): setăm
  // price_eur = prețul activ, ca tot ce e în aval (totaluri, email, text,
  // oferta salvată) să folosească exact prețul ales, fără a mai ști de mod.
  // Atașăm și descrierea, doar dacă produsul are una ȘI e bifată.
  const resolvedItems = useMemo(
    () =>
      items.map((i) => ({
        ...i,
        price_eur: priceFor(i, priceMode),
        description:
          includedDescSkus.has(i.sku) && descriptions[i.sku]
            ? descriptions[i.sku]
            : undefined,
      })),
    [items, priceMode, includedDescSkus, descriptions],
  );

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
  // Layout responsiv în interiorul cardului (CartSection e folosit și pe
  // desktop, și pe mobil) — comutăm grilele pe o coloană sub 768px.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const {
    sendOffer,
    logOffer,
    loading: sending,
    error: sendError,
    success: sendSuccess,
    setSuccess: setSendSuccess,
  } = useSendEmail();
  // „Marchează ca trimisă" — log ofertă pe alt canal decât emailul.
  const [showMarkSent, setShowMarkSent] = useState(false);
  const [markedChannel, setMarkedChannel] = useState<string | null>(null);

  // Banner-ul de succes dispare automat după câteva secunde
  useEffect(() => {
    if (!sendSuccess) return;
    const t = setTimeout(() => setSendSuccess(false), 6000);
    return () => clearTimeout(t);
  }, [sendSuccess, setSendSuccess]);

  const activeCurrency = currency || "RON";
  // Factor de conversie bază → afișare (NErotunjit). Ține cont de cursul manual
  // (interpretat „per 1 unitate din moneda catalogului"). Acest factor merge și
  // în email și în oferta salvată (exchange_rate).
  const displayRate = effectiveRate(baseCurrency, activeCurrency);
  // Limba emailului către client. Implicit = limba contactului (din prefill);
  // în lipsa ei, limba interfeței alese de lider (Setări); abia apoi limba
  // pieței catalogului (RO → română; restul → engleză). Liderul o poate
  // schimba oricând din selectorul de mai jos.
  const uiLang = i18n.language?.startsWith("en")
    ? "en"
    : i18n.language?.startsWith("ro")
      ? "ro"
      : "";
  const offerLang =
    storeOfferLang || uiLang || (catalogCountry === "RO" ? "ro" : "en");

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
        // Rotunjim linia în EUR ÎNAINTE de conversie — identic cu emailul și cu
        // oferta salvată (penny rounding), ca textul WhatsApp să arate exact
        // aceleași sume ca emailul.
        const unitPrice = priceFor(i, priceMode);
        const lineTotalEur = round2(unitPrice * i.qty * (1 - i.disc / 100));
        const lineTotalDisplay = round2(lineTotalEur * displayRate);
        const qty = i.qty > 1 ? ` x${i.qty}` : "";
        // La reducere: prețul întreg TĂIAT (~...~ = strikethrough în WhatsApp)
        // → prețul redus, ca să se vadă reducerea.
        if (i.disc > 0) {
          const origDisplay = round2(round2(unitPrice * i.qty) * displayRate);
          return `• ${i.name}${qty} — ~${formatAmount(origDisplay, activeCurrency)}~ → ${formatAmount(lineTotalDisplay, activeCurrency)} (-${i.disc}%)`;
        }
        return `• ${i.name}${qty} — ${formatAmount(lineTotalDisplay, activeCurrency)}`;
      })
      .join("\n");
    const salut = clientName
      ? i18n.t("calculator.offerText.greetingNamed", { lng: offerLang, name: clientName })
      : i18n.t("calculator.offerText.greeting", { lng: offerLang });
    let msg = `${salut}\n\n${i18n.t("calculator.offerText.intro", { lng: offerLang })}\n\n${produse}`;
    if (transport > 0)
      msg += `\n\n${i18n.t("calculator.offerText.transport", { lng: offerLang, amount: formatAmount(convertFromBase(transport, baseCurrency, activeCurrency), activeCurrency) })}`;
    msg += `\n${"─".repeat(25)}\n${i18n.t("calculator.offerText.total", { lng: offerLang, amount: formatAmount(total, activeCurrency) })}`;
    if (notes) msg += `\n\n${notes}`;
    if (enrollLink)
      msg += `\n\n${i18n.t("calculator.offerText.enrollLink", { lng: offerLang })}\n${enrollLink}`;
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
    const digits = clientPhone ? normalizePhone(clientPhone) : "";
    const url = digits
      ? `https://wa.me/${digits}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener");
  }

  // Loghează oferta ca trimisă pe alt canal decât emailul (WhatsApp/telefon/alt).
  // Salvează aceeași ofertă în istoric (sent_via=canal) și golește coșul.
  async function markOfferSent(channel: "whatsapp" | "phone" | "other") {
    if (!requireAccess()) return;
    const ok = await logOffer(
      {
        clientName,
        clientEmail,
        clientPhone,
        notes,
        items: resolvedItems,
        transport,
        totalDisplay: total,
        totalEur,
        exchangeRate: displayRate,
        currency: activeCurrency,
        baseCurrency,
        lang: offerLang,
        contactId: prefillContactId || undefined,
        enrollLink: enrollLink || undefined,
        resourceIds:
          selectedResourceIds.length > 0 ? selectedResourceIds : undefined,
      },
      channel,
    );
    if (ok) {
      setMarkedChannel(channel);
      setShowMarkSent(false);
      clearCart();
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setNotes("");
      setPrefillContactId(null);
      setSelectedResourceIds([]);
      setShowResourcePicker(false);
      setShowOfferText(false);
      setTimeout(() => setMarkedChannel(null), 4000);
    }
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

  // Converted to display currency (din moneda de bază a ofertei)
  const subtotal = convertFromBase(subtotalEur, baseCurrency, activeCurrency);
  const discount = convertFromBase(discountEur, baseCurrency, activeCurrency);
  // Totalul afișat folosește ACEEAȘI sursă unică (penny rounding) ca emailul și
  // oferta salvată: Σ(linii rotunjite) + transport rotunjit. Astfel panoul,
  // textul WhatsApp, previzualizarea, emailul și suma stocată sunt identice.
  const offerTotals = computeOfferTotals(resolvedItems, transport, displayRate);
  const total = offerTotals.totalDisplay;
  const totalEurRounded = offerTotals.totalEur;

  // Validare trimitere ofertă: numele e obligatoriu, iar emailul trebuie să fie
  // unul real (nu placeholder-ul „@noemail.local"). Butonul de trimitere rămâne
  // dezactivat altfel, ca să nu trimitem oferte fără destinatar valid.
  const offerNameOk = clientName.trim().length > 0;
  const offerEmailOk =
    /\S+@\S+\.\S+/.test(clientEmail.trim()) && !clientEmail.includes("@noemail.local");
  const canSendOffer = offerNameOk && offerEmailOk;

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
            {markedChannel
              ? tr("calculator.offerMarkedSent", {
                  channel: tr(`calculator.markChannel.${markedChannel}`),
                })
              : tr("calculator.offerSentTo", { email: successEmail })}
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
            {tr("calculator.cartEmpty")}
          </div>
          <div style={{ fontSize: "13px", color: C.muted }}>
            {tr("calculator.cartEmptyHint")}
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
        const priceEur = priceFor(item, priceMode);
        const itemBase = item.currency || baseCurrency;
        // Rotunjim linia în EUR înainte de conversie (penny rounding) — la fel ca
        // emailul, textul și oferta salvată, ca sumele afișate să fie identice.
        const lineTotalEur = round2(priceEur * item.qty * (1 - item.disc / 100));
        const priceInCurrency = convertFromBase(priceEur, itemBase, activeCurrency);
        const lineTotalInCurrency = convertFromBase(lineTotalEur, itemBase, activeCurrency);
        const showEurSecondary = activeCurrency !== itemBase;
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
            {descriptions[item.sku] && (
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: C.text2,
                  lineHeight: 1.4,
                }}
              >
                <input
                  type="checkbox"
                  checked={includedDescSkus.has(item.sku)}
                  onChange={() => toggleDesc(item.sku)}
                  style={{ marginTop: "2px", accentColor: C.primary, cursor: "pointer", flexShrink: 0 }}
                />
                <span>{tr("calculator.includeDescription")}</span>
              </label>
            )}
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
                <span style={{ fontSize: "12px", color: C.muted }}>{tr("calculator.discountShort")}</span>
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
                  {formatAmount(priceInCurrency, activeCurrency)}{tr("calculator.perPiece")}
                  {item.disc > 0 ? ` · −${item.disc}%` : ""}
                </span>
                {showEurSecondary && (
                  <div style={{ fontSize: "10px", color: C.muted }}>
                    {formatAmount(priceEur, itemBase)}{tr("calculator.perPiece")}
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
                    {formatAmount(lineTotalEur, itemBase)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

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
        {showCustom ? tr("calculator.hide") : tr("calculator.addSpecialProduct")}
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
            {tr("calculator.customProductHint", { currency: activeCurrency })}
          </div>
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={tr("calculator.productNamePlaceholder")}
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
              placeholder={tr("calculator.pricePlaceholder", { currency: activeCurrency })}
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
              placeholder={tr("calculator.qtyPlaceholder")}
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
              placeholder={tr("calculator.discPlaceholder")}
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
              if (!customName.trim() || !customPrice) return;
              const priceInCurrency = parseFloat(customPrice);
              // Validare preț: trebuie să fie un număr finit STRICT pozitiv (C3).
              // „0" e string truthy, deci trecea de garda de mai sus → o linie de
              // 0 într-o ofertă e aproape sigur o greșeală (preț uitat/typo).
              if (!Number.isFinite(priceInCurrency) || priceInCurrency <= 0) {
                alert(tr("calculator.invalidPrice"));
                return;
              }
              // Stocăm prețul în moneda de bază a ofertei (catalogul curent).
              const priceEur = convertFromBase(priceInCurrency, activeCurrency, baseCurrency);
              addCustomItem(
                customName.trim(),
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
            {tr("calculator.addToCart")}
          </button>
        </div>
      )}

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
          {tr("calculator.transportCost")}
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={
            transport > 0
              ? parseFloat(convertFromBase(transport, baseCurrency, activeCurrency).toFixed(2))
              : ""
          }
          placeholder="0"
          onChange={(e) => {
            const valueInCurrency = parseFloat(e.target.value) || 0;
            // Stocăm transportul în moneda de bază la precizie completă (fără round-trip drift).
            const valueInBase = valueInCurrency * effectiveRate(activeCurrency, baseCurrency);
            setTransport(valueInBase);
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
        {activeCurrency !== baseCurrency && transport > 0 && (
          <span style={{ fontSize: "11px", color: C.muted }}>
            {formatAmount(transport, baseCurrency)}
          </span>
        )}
      </div>

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
          { label: tr("calculator.totals.subtotal"), value: formatAmount(subtotal, activeCurrency) },
          ...(discountEur > 0
            ? [
                {
                  label: tr("calculator.totals.discounts"),
                  value: `−${formatAmount(discount, activeCurrency)}`,
                  red: true,
                },
              ]
            : []),
          ...(activeCurrency !== baseCurrency
            ? [{ label: tr("calculator.totals.total", { currency: baseCurrency }), value: formatAmount(totalEurRounded, baseCurrency) }]
            : []),
          { label: tr("calculator.totals.points"), value: `${Math.round(totalPoints)} ${tr("calculator.points")}` },
          { label: tr("calculator.totals.products"), value: `${count}` },
          ...(transport > 0
            ? [
                {
                  label: tr("calculator.totals.transport"),
                  value:
                    activeCurrency !== baseCurrency
                      ? `${formatAmount(convertFromBase(transport, baseCurrency, activeCurrency), activeCurrency)} · ${formatAmount(transport, baseCurrency)}`
                      : formatAmount(transport, baseCurrency),
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
            {tr("calculator.totalToPay")}
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
            {activeCurrency !== baseCurrency && (
              <div style={{ fontSize: "11px", color: C.muted }}>
                {formatAmount(totalEurRounded, baseCurrency)}
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
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
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
              marginBottom: "4px",
            }}
          >
            <i className="ti ti-mail" style={{ fontSize: "13px" }} />
            {tr("calculator.sendOfferToClient")}
          </div>
          <div style={{ fontSize: "12px", color: C.muted, lineHeight: 1.4 }}>
            {tr("calculator.sendOfferSubtitle")}
          </div>
        </div>

        {/* ── 1. Date client ─────────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: C.text2,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            {tr("calculator.sectionClientData")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "8px",
              alignItems: "start",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: C.muted,
                  marginBottom: "4px",
                }}
              >
                {tr("calculator.clientNameLabel")} *
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={tr("calculator.clientNamePlaceholder")}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: C.bg2,
                  border: `1.5px solid ${C.border2}`,
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: C.dark,
                  fontFamily: "'DM Sans', sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: C.muted,
                  marginBottom: "4px",
                }}
              >
                {tr("calculator.phoneLabel")}
              </label>
              <PhoneInput
                value={clientPhone}
                onChange={setClientPhone}
                defaultCountry={catalogCountry || "RO"}
                placeholder={tr("calculator.phonePlaceholder")}
                theme={{ border: C.border2, inputBg: C.bg2, text: C.dark, focus: C.primary }}
              />
            </div>
          </div>
        </div>

        {/* ── 2. Detalii email ───────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: C.text2,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            {tr("calculator.sectionEmailDetails")}
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: C.muted,
                marginBottom: "4px",
              }}
            >
              {tr("calculator.emailLabel")} *
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder={tr("calculator.emailPlaceholder")}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: C.bg2,
                border: `1.5px solid ${clientEmail.includes("@noemail.local") ? C.red : C.border2}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {clientEmail.includes("@noemail.local") && (
            <div
              style={{
                marginBottom: "8px",
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
              {tr("calculator.noEmailWarning")}
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                color: C.muted,
                marginBottom: "4px",
              }}
            >
              {tr("calculator.emailLanguage")}
            </label>
            <select
              value={offerLang}
              onChange={(e) => setOfferLang(e.target.value)}
              style={{
                padding: "8px 12px",
                background: C.bg2,
                border: `1.5px solid ${C.border2}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="ro">🇷🇴 {tr("calculator.langRo")}</option>
              <option value="en">🇬🇧 {tr("calculator.langEn")}</option>
            </select>
          </div>
        </div>

        {/* ── 3. Mesaj personalizat ──────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              color: C.muted,
              marginBottom: "4px",
            }}
          >
            {tr("calculator.customMessageLabel")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("calculator.customMessagePlaceholder")}
            rows={8}
            maxLength={5000}
            style={{
              width: "100%",
              minHeight: "180px",
              padding: "12px 14px",
              background: C.bg2,
              border: `1.5px solid ${C.border2}`,
              borderRadius: "8px",
              fontSize: "13px",
              lineHeight: 1.6,
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ textAlign: "right", fontSize: "11px", color: C.muted, marginTop: "3px" }}>
            {notes.length} / 5000
          </div>
        </div>

        {/* ── 4. Extra opțiuni ───────────────────────────── */}
        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: C.text2,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            {tr("calculator.sectionExtraOptions")}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Resurse atașate (ca linkuri securizate) */}
            <div>
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
                {tr("calculator.addResource")}
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
                      {tr("calculator.noResources")}
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
                          title={tr("calculator.removeResource")}
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

            {/* Link înscriere — se include în email */}
            <div>
              <EnrollLink
                clientName={clientName}
                clientPhone={clientPhone}
                compact={true}
                country={catalogCountry}
                onLinkGenerated={setEnrollLink}
              />
            </div>
          </div>
        </div>

        {/* ── 5. Footer acțiuni ──────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: "10px",
            paddingTop: "12px",
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <button
            onClick={() => setShowPreview(true)}
            disabled={items.length === 0}
            style={{
              background: "none",
              border: "none",
              padding: "8px 4px",
              fontSize: "12px",
              color: items.length === 0 ? C.muted : C.text2,
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'DM Sans', sans-serif",
              justifyContent: "center",
              textDecoration: items.length === 0 ? "none" : "underline",
              textUnderlineOffset: "3px",
            }}
          >
            <i className="ti ti-eye" style={{ fontSize: "14px" }} />
            {tr("calculator.previewBeforeSend")}
          </button>

          <button
            disabled={sending || !canSendOffer}
            title={!canSendOffer ? tr("calculator.sendDisabledHint") : undefined}
            onClick={async () => {
              const emailSentTo = clientEmail;
              const ok = await sendOffer({
                clientName,
                clientEmail,
                clientPhone,
                notes,
                items: resolvedItems,
                transport,
                totalDisplay: total,
                totalEur,
                exchangeRate: displayRate,
                currency: activeCurrency,
                baseCurrency,
                lang: offerLang,
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
              background: sending || !canSendOffer ? C.muted : C.primary,
              border: "none",
              borderRadius: "8px",
              padding: "11px 20px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sending || !canSendOffer ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: isMobile ? "100%" : "auto",
            }}
          >
            {sending
              ? <><i className="ti ti-loader-2" style={{ fontSize: "14px" }} /> {tr("calculator.sending")}</>
              : <><i className="ti ti-send" style={{ fontSize: "14px" }} /> {tr("calculator.sendOfferButton")}</>
            }
          </button>
        </div>

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
              {tr("calculator.offerSentTo", { email: successEmail || clientEmail })}
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
              {tr("calculator.createNewOffer")}
            </button>
          </div>
        )}
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
          {tr("calculator.offerAsText")}
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
                {tr("calculator.editThenCopy")}
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
                {tr("calculator.regenerateFromCart")}
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
                {offerTextCopied ? tr("calculator.textCopied") : tr("calculator.copyOfferText")}
              </button>
              <button
                onClick={sendOfferWhatsApp}
                title={tr("calculator.enroll.sendWhatsApp")}
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
                {tr("calculator.whatsapp")}
              </button>
            </div>

            {/* Marchează ca trimisă — log pe alt canal decât emailul */}
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: `1px solid ${C.border2}`,
              }}
            >
              {!showMarkSent ? (
                <button
                  onClick={() => setShowMarkSent(true)}
                  disabled={sending}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    border: `1px solid ${C.border2}`,
                    borderRadius: "9px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: C.text2,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: sending ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <i className="ti ti-checkbox" style={{ fontSize: "15px" }} />
                  {tr("calculator.markAsSent")}
                </button>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: C.muted,
                      marginBottom: "8px",
                      textAlign: "center",
                    }}
                  >
                    {tr("calculator.markAsSentChoose")}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(
                      [
                        { ch: "whatsapp", icon: "ti-brand-whatsapp" },
                        { ch: "phone", icon: "ti-phone" },
                        { ch: "other", icon: "ti-dots" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.ch}
                        onClick={() => markOfferSent(opt.ch)}
                        disabled={sending}
                        style={{
                          flex: 1,
                          padding: "11px 6px",
                          background: C.bg2,
                          border: `1px solid ${C.border2}`,
                          borderRadius: "9px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: C.dark,
                          fontFamily: "'DM Sans', sans-serif",
                          cursor: sending ? "not-allowed" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <i
                          className={`ti ${opt.icon}`}
                          style={{ fontSize: "18px" }}
                        />
                        {tr(`calculator.markChannel.${opt.ch}`)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowMarkSent(false)}
                    disabled={sending}
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      padding: "6px",
                      background: "none",
                      border: "none",
                      fontSize: "12px",
                      color: C.muted,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {tr("calculator.markAsSentCancel")}
                  </button>
                </div>
              )}
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
          {tr("calculator.clearCart")}
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
            items: resolvedItems,
            transport,
            totalDisplay: total,
            totalEur,
            exchangeRate: displayRate,
            currency: activeCurrency,
            baseCurrency,
            lang: offerLang,
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
                    {tr("calculator.previewEmailTitle")}
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
                  {tr("calculator.close")}
                </button>
              </div>
              {/* Iframe email */}
              <iframe
                srcDoc={previewHtml}
                title={tr("calculator.previewEmailFrame")}
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

// ── CATALOG SELECTOR ──────────────────────────────────────
// Alege catalogul de produse (țara) folosit pentru această ofertă.
// Implicit = țara liderului; opțiunile = doar țările cu produse importate.
const COUNTRY_LABELS: Record<string, string> = {
  RO: "🇷🇴 România",
  DE: "🇩🇪 Germania",
  FR: "🇫🇷 Franța",
  IT: "🇮🇹 Italia",
  ES: "🇪🇸 Spania",
  NL: "🇳🇱 Olanda",
  BE: "🇧🇪 Belgia",
  AT: "🇦🇹 Austria",
  IE: "🇮🇪 Irlanda",
  PT: "🇵🇹 Portugalia",
  FI: "🇫🇮 Finlanda",
  GB: "🇬🇧 UK",
  MD: "🇲🇩 Moldova",
  UA: "🇺🇦 Ucraina",
  US: "🇺🇸 SUA",
};

function CatalogSelector() {
  const { t: tr } = useTranslation();
  const catalogCountry = useCartStore((s) => s.catalogCountry);
  const setCatalogCountry = useCartStore((s) => s.setCatalogCountry);
  const itemCount = useCartStore((s) => s.items.length);
  const { countryCode } = useSubscription();
  const { data: countries } = useProductCountries();

  // Lista finală de opțiuni: țările cu produse importate; dacă încă nu s-a
  // încărcat nimic, măcar țara curentă din coș, ca să nu fie selector gol.
  const options = countries && countries.length > 0 ? countries : [catalogCountry];

  // Ofertă nouă (coș gol) → catalogul implicit = țara liderului, dacă există
  // produse pentru ea. Ofertă în curs → păstrăm catalogul ales.
  useEffect(() => {
    if (itemCount > 0) return;
    if (!countries || countries.length === 0) return;
    if (countries.includes(countryCode) && catalogCountry !== countryCode) {
      setCatalogCountry(countryCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, countryCode, itemCount]);

  // Cu un singur catalog disponibil nu are rost selectorul.
  if (options.length <= 1) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: C.card,
        border: `1px solid ${C.border2}`,
        borderRadius: 12,
        padding: "10px 14px",
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <i className="ti ti-map-pin" style={{ fontSize: 17, color: C.primary }} />
      <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>
        {tr("calculator.catalog.label")}
      </div>
      <select
        value={catalogCountry}
        onChange={(e) => setCatalogCountry(e.target.value)}
        style={{
          marginLeft: "auto",
          padding: "8px 12px",
          background: "#F8FAF8",
          border: `1.5px solid ${C.border2}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: C.dark,
          fontFamily: "'DM Sans', sans-serif",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((code) => (
          <option key={code} value={code}>
            {tr(`calculator.countries.${code}`, { defaultValue: COUNTRY_LABELS[code] || code })}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function CalculatorPage() {
  const { t: tr } = useTranslation();
  const {
    getCount, items, clientName, clearCart,
    setClientName, setClientEmail, setClientPhone, setPrefillContactId, setOfferLang,
  } = useCartStore();
  const count = getCount();
  const { hasAccess, loading: subLoading, openPaywall } = useSubscription();
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
      const { id, name, email, phone, language } = JSON.parse(raw);
      clearCart();
      if (name) setClientName(name);
      if (email && !email.includes("@noemail.local")) setClientEmail(email);
      if (phone) setClientPhone(phone);
      if (id) setPrefillContactId(id);
      if (language) setOfferLang(language);
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

  // Fără acces (trial expirat / fără abonament): deschide DIRECT modalul de
  // plată, iar builder-ul rămâne blurat în spate (vezi return-ul). Bannerul
  // din AppLayout rămâne calea de re-deschidere dacă userul închide modalul.
  useEffect(() => {
    if (!subLoading && !hasAccess) openPaywall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLoading, hasAccess]);

  // ── POARTĂ DE ACCES ───────────────────────────────────────
  // Constructorul de oferte e disponibil DOAR cu acces activ (abonament,
  // trial valid, admin sau free_access). Trial expirat / fără abonament →
  // ecran de blocare, ca utilizatorul să nu poată folosi offer builder-ul
  // fără cont activ. Cât timp se încarcă abonamentul, arătăm un spinner
  // (altfel ar clipi blocajul pentru cei care AU acces).
  if (subLoading) {
    return (
      <div
        className="calc-page"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "80px 20px",
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
      </div>
    );
  }
  return (
    <div
      className="calc-page"
      style={
        !hasAccess
          ? { filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }
          : undefined
      }
    >
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
              {tr("calculator.draftBanner.title", {
                count,
                forName: clientName ? tr("calculator.draftBanner.forName", { name: clientName }) : "",
              })}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {tr("calculator.draftBanner.subtitle")}
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
              {tr("calculator.draftBanner.continue")}
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
              {tr("calculator.draftBanner.newOffer")}
            </button>
          </div>
        </div>
      )}

      {/* Selector catalog produse (țară) — apare doar cu >1 catalog */}
      <CatalogSelector />

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
            {tr("calculator.searchTitle")}
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
            {tr("calculator.cartTitle")}
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
              label: tr("calculator.tabSearch"),
            },
            {
              key: "cart",
              icon: "ti-shopping-cart",
              label: tr("calculator.tabCart", { count: count > 0 ? ` (${count})` : "" }),
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
        @media (max-width: 768px) {
          .calc-page input, .calc-page textarea, .calc-page select { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}
