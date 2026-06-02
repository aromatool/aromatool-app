import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const C = {
  bg: "#FDFAFF",
  card: "#FFFFFF",
  border: "rgba(196,168,232,0.3)",
  border2: "rgba(196,168,232,0.5)",
  primary: "#7B5EA7",
  dark: "#2D1A4E",
  muted: "#9B80C4",
  text2: "#6B5B9E",
  bg2: "#F5F0FF",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  red: "#C94F6A",
  redbg: "#FFF0F4",
};

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

interface Offer {
  id: string;
  sent_at: string;
  total_display: number;
  total_eur: number;
  exchange_rate: number;
  currency: string;
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  prospect: { bg: "#FFF8E7", color: "#B8860B", label: "🟡 Prospect" },
  client_nou: { bg: C.greenbg, color: C.green, label: "🟢 Client nou" },
  client_fidel: { bg: C.bg2, color: C.primary, label: "⭐ Fidel" },
};

export default function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadOffers();
  }, [user]);

  async function loadOffers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("offers")
      .select(
        `
        id, sent_at, total_display, total_eur, exchange_rate, currency,
        notes, transport, products_json,
        contacts ( id, email, name, status )
      `,
      )
      .eq("user_id", user!.id)
      .order("sent_at", { ascending: false });

    if (!error && data) setOffers(data as Offer[]);
    setLoading(false);
  }

  const filtered = offers.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.contacts?.email?.toLowerCase().includes(q) ||
      o.contacts?.name?.toLowerCase().includes(q) ||
      o.products_json?.some((p) => p.name.toLowerCase().includes(q))
    );
  });

  const totalEur = offers.reduce((s, o) => s + (o.total_eur || 0), 0);
  const uniqueClients = new Set(
    offers.map((o) => o.contacts?.email).filter(Boolean),
  ).size;

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px" }}
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
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px",
            color: C.dark,
          }}
        >
          Oferte trimise
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            {
              label: "Total oferte",
              value: String(offers.length),
              color: C.dark,
            },
            {
              label: "Clienți unici",
              value: String(uniqueClients),
              color: C.primary,
            },
            {
              label: "Valoare totală",
              value: `€ ${totalEur.toFixed(2)}`,
              color: C.green,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                padding: "10px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: C.muted,
                  marginBottom: "2px",
                }}
              >
                {stat.label}
              </div>
              <div
                style={{ fontSize: "18px", fontWeight: 700, color: stat.color }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <span
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: C.muted,
          }}
        >
          🔍
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după email, nume sau produs..."
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
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
      </div>

      {/* Offers list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "16px",
            background: C.card,
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "18px",
              color: C.dark,
              marginBottom: "6px",
            }}
          >
            {search ? "Niciun rezultat" : "Nu ai trimis oferte încă"}
          </div>
          <div style={{ fontSize: "13px", color: C.muted }}>
            {search
              ? "Încearcă alte cuvinte"
              : "Adaugă produse în coș și trimite prima ofertă"}
          </div>
        </div>
      ) : (
        filtered.map((offer) => {
          const isExpanded = expandedId === offer.id;
          const currency = offer.currency || "RON";
          const status = offer.contacts?.status || "prospect";
          const statusInfo = STATUS_COLORS[status] || STATUS_COLORS.prospect;
          const productsPreview = offer.products_json
            ?.slice(0, 2)
            .map((p) => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`)
            .join(", ");
          const moreCount = (offer.products_json?.length || 0) - 2;

          return (
            <div
              key={offer.id}
              style={{
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "10px",
              }}
            >
              {/* Header row */}
              <div
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : offer.id)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: C.dark,
                        }}
                      >
                        {offer.contacts?.name || offer.contacts?.email || "—"}
                      </span>
                      {offer.contacts?.name && (
                        <span style={{ fontSize: "12px", color: C.muted }}>
                          {offer.contacts.email}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: statusInfo.bg,
                          color: statusInfo.color,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: C.muted,
                        marginBottom: "4px",
                      }}
                    >
                      📅 {formatDate(offer.sent_at)}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: C.text2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🌿 {productsPreview}
                      {moreCount > 0 ? ` +${moreCount} produse` : ""}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "18px",
                        color: C.dark,
                        fontWeight: 600,
                      }}
                    >
                      {fmtCurrency(offer.total_display, currency)}
                    </div>
                    {currency !== "EUR" && (
                      <div style={{ fontSize: "11px", color: C.muted }}>
                        € {(offer.total_eur || 0).toFixed(2)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "11px",
                        color: C.muted,
                        marginTop: "4px",
                      }}
                    >
                      {isExpanded ? "▲" : "▼"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "14px",
                    paddingTop: "14px",
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  {/* Products */}
                  <div style={{ marginBottom: "12px" }}>
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
                      Produse
                    </div>
                    {offer.products_json?.map((p, i) => {
                      const lineTotalEur =
                        p.price_eur * p.qty * (1 - p.disc / 100);
                      const lineTotalDisplay =
                        lineTotalEur * (offer.exchange_rate || 1);
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "6px 0",
                            borderBottom: `1px solid ${C.border}`,
                            fontSize: "13px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span style={{ color: C.dark }}>{p.name}</span>
                            {p.disc > 0 && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: C.red,
                                  marginLeft: "6px",
                                }}
                              >
                                −{p.disc}%
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "16px",
                              flexShrink: 0,
                              alignItems: "center",
                            }}
                          >
                            <span style={{ color: C.muted, fontSize: "12px" }}>
                              ×{p.qty}
                            </span>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 500, color: C.dark }}>
                                {fmtCurrency(lineTotalDisplay, currency)}
                              </div>
                              {currency !== "EUR" && (
                                <div
                                  style={{ fontSize: "10px", color: C.muted }}
                                >
                                  € {lineTotalEur.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Meta info */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginBottom: "12px",
                    }}
                  >
                    {offer.transport > 0 && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: C.muted,
                          background: C.bg2,
                          padding: "3px 10px",
                          borderRadius: "999px",
                        }}
                      >
                        🚚 Transport:{" "}
                        {fmtCurrency(
                          offer.transport * (offer.exchange_rate || 1),
                          currency,
                        )}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "12px",
                        color: C.muted,
                        background: C.bg2,
                        padding: "3px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      📈 1€ = {(offer.exchange_rate || 0).toFixed(4)} {currency}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: C.muted,
                        background: C.bg2,
                        padding: "3px 10px",
                        borderRadius: "999px",
                      }}
                    >
                      💱 {currency}
                    </span>
                  </div>

                  {offer.notes && (
                    <div
                      style={{
                        background: C.bg2,
                        borderRadius: "8px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        color: C.text2,
                        marginBottom: "12px",
                      }}
                    >
                      📝 {offer.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() => {
                        const products = offer.products_json
                          ?.map(
                            (p) =>
                              `• ${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}${p.disc > 0 ? ` (−${p.disc}%)` : ""} — ${fmtCurrency(p.price_eur * p.qty * (1 - p.disc / 100) * (offer.exchange_rate || 1), currency)}`,
                          )
                          .join("\n");
                        const text = `Ofertă ${offer.contacts?.name || offer.contacts?.email}:\n\n${products}\n\n💜 Total: ${fmtCurrency(offer.total_display, currency)}`;
                        navigator.clipboard.writeText(text);
                        setCopiedId(offer.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      style={{
                        padding: "7px 14px",
                        background: copiedId === offer.id ? C.greenbg : C.bg2,
                        border: `1px solid ${copiedId === offer.id ? C.green : C.border2}`,
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: copiedId === offer.id ? C.green : C.dark,
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === offer.id
                        ? "✅ Copiat!"
                        : "📋 Copiază sumar"}
                    </button>

                    {offer.contacts?.email && (
                      <button
                        onClick={() => {
                          const waNum = (offer.contacts?.email || "").replace(
                            /[^0-9]/g,
                            "",
                          );
                          window.open(
                            `mailto:${offer.contacts?.email}?subject=Oferta ta Young Living`,
                            "_blank",
                          );
                        }}
                        style={{
                          padding: "7px 14px",
                          background: C.bg2,
                          border: `1px solid ${C.border2}`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: C.dark,
                          fontFamily: "'DM Sans', sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        📧 Trimite email
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
