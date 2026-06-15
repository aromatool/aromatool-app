import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import i18n from "../i18n";
import { uiLocale } from "../lib/locale";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

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
  rose: "#D4A5A0",
  roseLight: "#FDF0EE",
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
  amber: "#C4906A",
  amberLight: "#FDF5EE",
  border: "#EDE8E0",
  white: "#FFFFFF",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
};

interface Offer {
  id: string;
  sent_at: string;
  total_display: number;
  total_eur: number;
  currency: string;
  base_currency?: string;
  exchange_rate: number;
  sent_via?: string | null;
  notes: string | null;
  transport: number;
  products_json: Array<{
    name: string;
    sku: string;
    qty: number;
    disc: number;
    price_eur: number;
  }>;
  contacts: {
    id: string;
    email: string;
    name: string | null;
    status: string;
  } | null;
}

interface ClientGroup {
  clientKey: string;
  clientName: string;
  clientEmail: string;
  clientStatus: string;
  offers: Offer[];
  totalEur: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  RON: "RON",
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  HUF: "Ft",
  PLN: "zł",
  CZK: "Kč",
};

function fmtCurrency(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formatted = (amount || 0).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (["USD", "GBP"].includes(currency)) return `${symbol}${formatted}`;
  return `${formatted} ${symbol}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(uiLocale(i18n.language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


const STATUS_STYLE: Record<
  string,
  { bg: string; color: string; labelKey: string }
> = {
  prospect: { bg: T.amberLight, color: T.amber, labelKey: "offers.statusProspect" },
  client_nou: { bg: T.greenLight, color: T.green, labelKey: "offers.statusClientNou" },
  client_fidel: { bg: T.sageLight, color: T.sage, labelKey: "offers.statusClientFidel" },
  in_followup: { bg: T.lavenderLight, color: T.lavender, labelKey: "offers.statusInFollowup" },
  inactiv: { bg: T.border, color: T.muted, labelKey: "offers.statusInactiv" },
};

// Cheia de grupare per client (același calcul ca la grupare).
function offerClientKey(offer: Offer): string {
  return offer.contacts?.id || offer.contacts?.email || "unknown";
}

// O ofertă „logată extern" e rândul minimal creat de butonul „Marchează ca
// trimisă" din CRM: fără produse și total 0, doar ca să iasă contactul din
// „Trimite prima ofertă". Nu are detalii de afișat → o tratăm separat.
function isExternalOffer(offer: Offer): boolean {
  return !offer.products_json || offer.products_json.length === 0;
}

// Eticheta canalului pe care a fost comunicată oferta (sent_via).
function channelLabel(sentVia: string | null | undefined, t: (k: string) => string): string {
  switch (sentVia) {
    case "whatsapp":
      return t("offers.channelWhatsapp");
    case "phone":
      return t("offers.channelPhone");
    case "email":
      return t("offers.channelEmail");
    case "both":
      return t("offers.channelBoth");
    default:
      return t("offers.channelOther");
  }
}

export default function OffersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusOfferId = searchParams.get("offer");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const appliedFocus = useRef<string | null>(null);

  // Mobile detection — only used to relax desktop-only spacing/typography on
  // small screens. Desktop layout stays pixel-identical.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (user) loadOffers();
  }, [user]);

  // Deep-link din Dashboard/CRM (?offer=<id>): expandează clientul + oferta
  // țintă o singură dată per valoare, ca să nu suprascrie click-urile manuale.
  useEffect(() => {
    if (!focusOfferId || offers.length === 0) return;
    if (appliedFocus.current === focusOfferId) return;
    const target = offers.find((o) => o.id === focusOfferId);
    if (!target) return;
    const key = offerClientKey(target);
    setExpandedClients((prev) => new Set(prev).add(key));
    setExpandedOffers((prev) => new Set(prev).add(focusOfferId));
    appliedFocus.current = focusOfferId;
  }, [focusOfferId, offers]);

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("offer");
    setSearchParams(next, { replace: true });
  };

  async function loadOffers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("offers")
      .select(
        `id, sent_at, total_display, total_eur, exchange_rate, currency, base_currency, notes, transport, products_json, sent_via, contacts(id, email, name, status)`,
      )
      .eq("user_id", user!.id)
      .order("sent_at", { ascending: false });
    if (!error && data) setOffers(data as unknown as Offer[]);
    setLoading(false);
  }

  // Group by client
  const grouped: ClientGroup[] = [];
  const seen = new Map<string, ClientGroup>();

  offers.forEach((offer) => {
    const key = offer.contacts?.id || offer.contacts?.email || "unknown";
    const name = offer.contacts?.name || offer.contacts?.email || "—";
    const email = offer.contacts?.email || "";
    const status = offer.contacts?.status || "prospect";

    if (!seen.has(key)) {
      const group: ClientGroup = {
        clientKey: key,
        clientName: name,
        clientEmail: email,
        clientStatus: status,
        offers: [],
        totalEur: 0,
      };
      seen.set(key, group);
      grouped.push(group);
    }
    const g = seen.get(key)!;
    g.offers.push(offer);
    g.totalEur += offer.total_eur || 0;
  });

  // Filter
  const filtered = grouped.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      g.clientName.toLowerCase().includes(q) ||
      g.clientEmail.toLowerCase().includes(q) ||
      g.offers.some((o) =>
        o.products_json?.some((p) => p.name.toLowerCase().includes(q)),
      )
    );
  });

  // Deep-link: grupul-client al ofertei țintă (dacă există în datele încărcate).
  const focusGroup =
    focusOfferId && !search.trim()
      ? grouped.find((g) => g.offers.some((o) => o.id === focusOfferId)) || null
      : null;

  // Când venim cu ?offer= și fără căutare activă, arătăm doar clientul ofertei.
  const displayed = focusGroup
    ? filtered.filter((g) => g.clientKey === focusGroup.clientKey)
    : filtered;

  const toggleClient = (key: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleOffer = (id: string) => {
    setExpandedOffers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalEurAll = offers.reduce((s, o) => s + (o.total_eur || 0), 0);

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px" }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            border: `3px solid ${T.border}`,
            borderTopColor: T.sage,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "22px", fontWeight: 500, color: T.espresso }}>
          {t("offers.title")}
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            {
              label: t("offers.statTotalOffers"),
              value: String(offers.length),
              color: T.espresso,
            },
            {
              label: t("offers.statUniqueClients"),
              value: String(grouped.length),
              color: T.sage,
            },
            {
              label: t("offers.statTotalValue"),
              value: `€ ${totalEurAll.toFixed(0)}`,
              color: T.green,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: "12px",
                padding: "10px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: T.muted,
                  marginBottom: "2px",
                }}
              >
                {s.label}
              </div>
              <div
                style={{ fontSize: "18px", fontWeight: 500, color: s.color }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Banner filtrare deep-link (?offer=) */}
      {focusGroup && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: T.sageLight,
            border: `0.5px solid ${T.sageMid}`,
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: T.sageDark,
              minWidth: 0,
            }}
          >
            <i className="ti ti-filter" style={{ fontSize: "16px" }} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t("offers.showingOffersOf")}{" "}
              <strong>{focusGroup.clientName}</strong>
            </span>
          </div>
          <button
            onClick={clearFocus}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 12px",
              fontSize: "12px",
              fontFamily: "inherit",
              background: T.white,
              border: `0.5px solid ${T.sageMid}`,
              borderRadius: "8px",
              color: T.sageDark,
              cursor: "pointer",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: "13px" }} />
            {t("offers.viewAllOffers")}
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "16px",
            color: T.muted,
          }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("offers.searchPlaceholder")}
          style={{
            width: "100%",
            padding: "10px 12px 10px 38px",
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: "10px",
            // 16px on mobile prevents iOS Safari from auto-zooming on focus.
            fontSize: isMobile ? "16px" : "14px",
            color: T.espresso,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Grouped list */}
      {displayed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${T.border}`,
            borderRadius: "16px",
            background: T.white,
          }}
        >
          <i
            className="ti ti-file-off"
            style={{
              fontSize: "40px",
              color: T.muted,
              display: "block",
              marginBottom: "12px",
            }}
          />
          <div
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: T.espresso,
              marginBottom: "6px",
            }}
          >
            {search ? t("offers.emptyNoResults") : t("offers.emptyNoOffers")}
          </div>
          <div style={{ fontSize: "13px", color: T.muted }}>
            {search
              ? t("offers.emptyNoResultsHint")
              : t("offers.emptyNoOffersHint")}
          </div>
        </div>
      ) : (
        displayed.map((group) => {
          const isExpanded = expandedClients.has(group.clientKey);
          const latestOffer = group.offers[0];
          const statusStyle =
            STATUS_STYLE[group.clientStatus] || STATUS_STYLE.prospect;
          const initials = group.clientName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          // Există oferte mai vechi de expandat? Dacă nu, săgeata + toggle-ul
          // n-au ce face → le ascundem.
          const hasMore = group.offers.length > 1;
          // Toate ofertele clientului sunt loguri externe (fără produse) → nu
          // are sens să afișăm „€ 0.00" ca valoare totală.
          const groupExternalOnly = group.offers.every(isExternalOffer);

          return (
            <div
              key={group.clientKey}
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: "14px",
                marginBottom: "10px",
                overflow: "hidden",
              }}
            >
              {/* Client header — always visible */}
              <div
                style={{
                  padding: "14px 16px",
                  cursor: hasMore ? "pointer" : "default",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
                onClick={
                  hasMore ? () => toggleClient(group.clientKey) : undefined
                }
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: T.sageLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: T.sage,
                  }}
                >
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: T.espresso,
                      }}
                    >
                      {group.clientName}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontWeight: 500,
                      }}
                    >
                      {t(statusStyle.labelKey)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: T.muted,
                      marginTop: "2px",
                    }}
                  >
                    {group.offers.length === 1
                      ? t("offers.offerCount_one", { count: group.offers.length })
                      : t("offers.offerCount_other", {
                          count: group.offers.length,
                        })}{" "}
                    · {formatDate(latestOffer.sent_at)}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {groupExternalOnly ? (
                    <span
                      style={{
                        fontSize: "11px",
                        color: T.muted,
                        background: T.linen,
                        padding: "3px 10px",
                        borderRadius: "999px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("offers.sentExternalShort")}
                    </span>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 500,
                          color: T.espresso,
                        }}
                      >
                        € {group.totalEur.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "11px", color: T.muted }}>
                        {t("offers.total")}
                      </div>
                    </>
                  )}
                </div>

                {hasMore && (
                  <i
                    className={`ti ti-chevron-${isExpanded ? "up" : "down"}`}
                    style={{ fontSize: "18px", color: T.muted, flexShrink: 0 }}
                  />
                )}
              </div>

              {/* Latest offer — always visible under client header */}
              <OfferRow
                offer={latestOffer}
                isLatest={true}
                isExpanded={expandedOffers.has(latestOffer.id)}
                onToggle={() => toggleOffer(latestOffer.id)}
                copiedId={copiedId}
                setCopiedId={setCopiedId}
                highlight={latestOffer.id === focusOfferId}
                isMobile={isMobile}
              />

              {/* Older offers — visible when client expanded */}
              {isExpanded &&
                group.offers
                  .slice(1)
                  .map((offer) => (
                    <OfferRow
                      key={offer.id}
                      offer={offer}
                      isLatest={false}
                      isExpanded={expandedOffers.has(offer.id)}
                      onToggle={() => toggleOffer(offer.id)}
                      copiedId={copiedId}
                      setCopiedId={setCopiedId}
                      highlight={offer.id === focusOfferId}
                      isMobile={isMobile}
                    />
                  ))}

              {/* Show more button */}
              {!isExpanded && group.offers.length > 1 && (
                <div
                  onClick={() => toggleClient(group.clientKey)}
                  style={{
                    padding: "10px 16px",
                    borderTop: `0.5px solid ${T.border}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "12px", color: T.muted }}>
                    {t("offers.previousOffers", {
                      count: group.offers.length - 1,
                    })}
                  </span>
                  <i
                    className="ti ti-chevron-down"
                    style={{ fontSize: "13px", color: T.muted }}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function OfferRow({
  offer,
  isLatest,
  isExpanded,
  onToggle,
  copiedId,
  setCopiedId,
  highlight = false,
  isMobile = false,
}: {
  offer: Offer;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  copiedId: string | null;
  setCopiedId: (id: string | null) => void;
  highlight?: boolean;
  isMobile?: boolean;
}) {
  const { t } = useTranslation();
  const currency = offer.currency || "RON";
  // Moneda de bază a ofertei (prețurile din products_json sunt în ea).
  const base = offer.base_currency || "EUR";
  const productsPreview = offer.products_json
    ?.slice(0, 2)
    .map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`)
    .join(", ");
  const moreCount = (offer.products_json?.length || 0) - 2;
  // Log extern (fără produse): nu are sumar/preț/detalii de expandat.
  const external = isExternalOffer(offer);

  function copyOffer() {
    const products = offer.products_json
      ?.map((p) => {
        const total =
          p.price_eur * p.qty * (1 - p.disc / 100) * (offer.exchange_rate || 1);
        return `• ${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}${p.disc > 0 ? ` (−${p.disc}%)` : ""} — ${total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${currency}`;
      })
      .join("\n");
    const text = `${products}\n\nTotal: ${fmtCurrency(offer.total_display, currency)}`;
    navigator.clipboard.writeText(text);
    setCopiedId(offer.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div
      style={{
        borderTop: `0.5px solid ${T.border}`,
        background: highlight
          ? T.sageLight
          : isLatest
            ? T.white
            : T.cream,
        boxShadow: highlight ? `inset 3px 0 0 ${T.sage}` : "none",
      }}
    >
      {/* Row header */}
      <div
        onClick={external ? undefined : onToggle}
        style={{
          // Desktop indents offer rows under the client name (68px). On mobile
          // that wastes ~15% of the width, so rows sit flush with card padding.
          padding: isMobile ? "11px 16px" : "11px 16px 11px 68px",
          cursor: external ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {isLatest && (
          <span
            style={{
              fontSize: "10px",
              background: T.sageLight,
              color: T.sage,
              padding: "2px 7px",
              borderRadius: "999px",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {t("offers.badgeLatest")}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "12px",
              color: external ? T.muted : T.warm,
              fontStyle: external ? "italic" : "normal",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {external
              ? t("offers.sentExternal", {
                  channel: channelLabel(offer.sent_via, t),
                })
              : `${productsPreview ?? ""}${moreCount > 0 ? ` +${moreCount}` : ""}`}
          </div>
          <div style={{ fontSize: "11px", color: T.muted, marginTop: "1px" }}>
            {new Date(offer.sent_at).toLocaleDateString(uiLocale(i18n.language), {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        {!external && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{ fontSize: "14px", fontWeight: 500, color: T.espresso }}
            >
              {fmtCurrency(offer.total_display, currency)}
            </div>
            {currency !== base && (
              <div style={{ fontSize: "10px", color: T.muted }}>
                {fmtCurrency(offer.total_eur || 0, base)}
              </div>
            )}
          </div>
        )}
        {!external && (
          <i
            className={`ti ti-chevron-${isExpanded ? "up" : "down"}`}
            style={{ fontSize: "15px", color: T.muted, flexShrink: 0 }}
          />
        )}
      </div>

      {/* Expanded offer details */}
      {isExpanded && !external && (
        <div style={{ padding: isMobile ? "0 16px 14px" : "0 16px 14px 68px" }}>
          {/* Products */}
          <div
            style={{
              border: `0.5px solid ${T.border}`,
              borderRadius: "10px",
              overflow: "hidden",
              marginBottom: "10px",
            }}
          >
            {offer.products_json?.map((p, i) => {
              const lineTotalEur = p.price_eur * p.qty * (1 - p.disc / 100);
              const lineTotalDisplay =
                lineTotalEur * (offer.exchange_rate || 1);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom:
                      i < offer.products_json.length - 1
                        ? `0.5px solid ${T.border}`
                        : "none",
                    background: T.white,
                    fontSize: "13px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ color: T.espresso }}>{p.name}</span>
                    {p.qty > 1 && (
                      <span style={{ color: T.muted, marginLeft: "6px" }}>
                        ×{p.qty}
                      </span>
                    )}
                    {p.disc > 0 && (
                      <span
                        style={{
                          color: T.red,
                          fontSize: "11px",
                          marginLeft: "6px",
                        }}
                      >
                        −{p.disc}%
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 500, color: T.espresso }}>
                      {fmtCurrency(lineTotalDisplay, currency)}
                    </div>
                    {currency !== base && (
                      <div style={{ fontSize: "10px", color: T.muted }}>
                        {fmtCurrency(lineTotalEur, base)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "10px",
            }}
          >
            {offer.transport > 0 && (
              <span
                style={{
                  fontSize: "11px",
                  color: T.muted,
                  background: T.border,
                  padding: "3px 10px",
                  borderRadius: "999px",
                }}
              >
                {t("offers.transportLabel")}:{" "}
                {fmtCurrency(
                  offer.transport * (offer.exchange_rate || 1),
                  currency,
                )}
              </span>
            )}
            <span
              style={{
                fontSize: "11px",
                color: T.muted,
                background: T.border,
                padding: "3px 10px",
                borderRadius: "999px",
              }}
            >
              1 {base} = {(offer.exchange_rate || 0).toFixed(4)} {currency}
            </span>
          </div>

          {offer.notes && (
            <div
              style={{
                background: T.linen,
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                color: T.warm,
                marginBottom: "10px",
              }}
            >
              {offer.notes}
            </div>
          )}

          {/* Actions */}
          <button
            onClick={copyOffer}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              fontFamily: "inherit",
              background: copiedId === offer.id ? T.greenLight : T.white,
              border: `0.5px solid ${copiedId === offer.id ? T.green : T.border}`,
              borderRadius: "8px",
              color: copiedId === offer.id ? T.green : T.warm,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <i
              className={`ti ${copiedId === offer.id ? "ti-check" : "ti-copy"}`}
              style={{ fontSize: "14px" }}
            />
            {copiedId === offer.id ? t("offers.copied") : t("offers.copySummary")}
          </button>
        </div>
      )}
    </div>
  );
}
