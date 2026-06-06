import { useEffect, useState } from "react";
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
  exchange_rate: number;
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
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


const STATUS_STYLE: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  prospect: { bg: T.amberLight, color: T.amber, label: "Prospect" },
  client_nou: { bg: T.greenLight, color: T.green, label: "Client nou" },
  client_fidel: { bg: T.sageLight, color: T.sage, label: "Client fidel" },
  in_followup: { bg: T.lavenderLight, color: T.lavender, label: "Follow-up" },
  inactiv: { bg: T.border, color: T.muted, label: "Inactiv" },
};

export default function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set(),
  );
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadOffers();
  }, [user]);

  async function loadOffers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("offers")
      .select(
        `id, sent_at, total_display, total_eur, exchange_rate, currency, notes, transport, products_json, contacts(id, email, name, status)`,
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
          Oferte trimise
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            {
              label: "Total oferte",
              value: String(offers.length),
              color: T.espresso,
            },
            {
              label: "Clienți unici",
              value: String(grouped.length),
              color: T.sage,
            },
            {
              label: "Valoare totală",
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
          placeholder="Caută după client sau produs..."
          style={{
            width: "100%",
            padding: "10px 12px 10px 38px",
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: "10px",
            fontSize: "14px",
            color: T.espresso,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Grouped list */}
      {filtered.length === 0 ? (
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
            {search ? "Niciun rezultat" : "Nu ai trimis oferte încă"}
          </div>
          <div style={{ fontSize: "13px", color: T.muted }}>
            {search
              ? "Încearcă alte cuvinte"
              : "Adaugă produse în coș și trimite prima ofertă"}
          </div>
        </div>
      ) : (
        filtered.map((group) => {
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
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
                onClick={() => toggleClient(group.clientKey)}
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
                      {statusStyle.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: T.muted,
                      marginTop: "2px",
                    }}
                  >
                    {group.offers.length}{" "}
                    {group.offers.length === 1 ? "ofertă" : "oferte"} ·{" "}
                    {formatDate(latestOffer.sent_at)}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      color: T.espresso,
                    }}
                  >
                    € {group.totalEur.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "11px", color: T.muted }}>total</div>
                </div>

                <i
                  className={`ti ti-chevron-${isExpanded ? "up" : "down"}`}
                  style={{ fontSize: "18px", color: T.muted, flexShrink: 0 }}
                />
              </div>

              {/* Latest offer — always visible under client header */}
              <OfferRow
                offer={latestOffer}
                isLatest={true}
                isExpanded={expandedOffers.has(latestOffer.id)}
                onToggle={() => toggleOffer(latestOffer.id)}
                copiedId={copiedId}
                setCopiedId={setCopiedId}
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
                    + {group.offers.length - 1} oferte anterioare
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
}: {
  offer: Offer;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  copiedId: string | null;
  setCopiedId: (id: string | null) => void;
}) {
  const currency = offer.currency || "RON";
  const productsPreview = offer.products_json
    ?.slice(0, 2)
    .map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`)
    .join(", ");
  const moreCount = (offer.products_json?.length || 0) - 2;

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
        background: isLatest ? T.white : T.cream,
      }}
    >
      {/* Row header */}
      <div
        onClick={onToggle}
        style={{
          padding: "11px 16px 11px 68px",
          cursor: "pointer",
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
            Ultima
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "12px",
              color: T.warm,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {productsPreview}
            {moreCount > 0 ? ` +${moreCount}` : ""}
          </div>
          <div style={{ fontSize: "11px", color: T.muted, marginTop: "1px" }}>
            {new Date(offer.sent_at).toLocaleDateString("ro-RO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 500, color: T.espresso }}>
            {fmtCurrency(offer.total_display, currency)}
          </div>
          {currency !== "EUR" && (
            <div style={{ fontSize: "10px", color: T.muted }}>
              € {(offer.total_eur || 0).toFixed(2)}
            </div>
          )}
        </div>
        <i
          className={`ti ti-chevron-${isExpanded ? "up" : "down"}`}
          style={{ fontSize: "15px", color: T.muted, flexShrink: 0 }}
        />
      </div>

      {/* Expanded offer details */}
      {isExpanded && (
        <div style={{ padding: "0 16px 14px 68px" }}>
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
                    {currency !== "EUR" && (
                      <div style={{ fontSize: "10px", color: T.muted }}>
                        € {lineTotalEur.toFixed(2)}
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
                Transport:{" "}
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
              1€ = {(offer.exchange_rate || 0).toFixed(4)} {currency}
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
            {copiedId === offer.id ? "Copiat!" : "Copiază sumar"}
          </button>
        </div>
      )}
    </div>
  );
}
