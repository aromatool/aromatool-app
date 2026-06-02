import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const C = {
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
  orange: "#C97A2E",
  orangebg: "#FFF4E7",
};

interface Contact {
  id: string;
  name: string | null;
  email: string;
  status: string;
  last_offer_at: string | null;
  followup_count: number;
  followup_opted_out: boolean;
}

interface Offer {
  id: string;
  sent_at: string;
  total_display: number;
  currency: string;
  contacts: { name: string | null; email: string } | null;
}

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor(
    (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bună dimineața";
  if (h < 18) return "Bună ziua";
  return "Bună seara";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentOffers, setRecentOffers] = useState<Offer[]>([]);
  const [followUpDays, setFollowUpDays] = useState(5);
  const [inactiveDays] = useState(60);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);

    const [profileRes, contactsRes, offersRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, follow_up_days")
        .eq("id", user!.id)
        .single(),
      supabase
        .from("contacts")
        .select("id, name, email, status, followup_count, followup_opted_out")
        .eq("user_id", user!.id),
      supabase
        .from("offers")
        .select("id, sent_at, total_display, currency, contacts(name, email)")
        .eq("user_id", user!.id)
        .order("sent_at", { ascending: false })
        .limit(5),
    ]);

    if (profileRes.data) {
      setUserName(profileRes.data.full_name || "");
      setFollowUpDays(profileRes.data.follow_up_days || 5);
    }

    // Enrich contacts with last offer date
    if (contactsRes.data) {
      const { data: offerDates } = await supabase
        .from("offers")
        .select("contact_id, sent_at")
        .eq("user_id", user!.id);

      const lastOfferMap: Record<string, string> = {};
      offerDates?.forEach((o) => {
        if (!o.contact_id) return;
        if (
          !lastOfferMap[o.contact_id] ||
          o.sent_at > lastOfferMap[o.contact_id]
        ) {
          lastOfferMap[o.contact_id] = o.sent_at;
        }
      });

      setContacts(
        contactsRes.data.map((c) => ({
          ...c,
          last_offer_at: lastOfferMap[c.id] || null,
        })),
      );
    }

    if (offersRes.data) setRecentOffers(offersRes.data as Offer[]);
    setLoading(false);
  }

  const displayName =
    userName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "";

  // Compute dashboard items
  const needsOffer = contacts.filter(
    (c) => c.status === "prospect" && !c.last_offer_at && !c.followup_opted_out,
  );

  const needsFollowUp = contacts.filter(
    (c) =>
      c.status === "prospect" &&
      !c.followup_opted_out &&
      c.last_offer_at !== null &&
      daysSince(c.last_offer_at) !== null &&
      daysSince(c.last_offer_at)! >= followUpDays,
  );

  const inactive = contacts.filter(
    (c) =>
      (c.status === "client_nou" || c.status === "client_fidel") &&
      c.last_offer_at !== null &&
      daysSince(c.last_offer_at) !== null &&
      daysSince(c.last_offer_at)! >= inactiveDays,
  );

  const totalProspects = contacts.filter((c) => c.status === "prospect").length;
  const totalClients = contacts.filter(
    (c) => c.status === "client_nou" || c.status === "client_fidel",
  ).length;
  const totalTeam = contacts.filter((c) => c.status === "in_followup").length;

  const urgentCount =
    needsOffer.length + needsFollowUp.length + inactive.length;

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "80px" }}
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
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Greeting */}
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "26px",
            color: C.dark,
            marginBottom: "4px",
          }}
        >
          {getGreeting()}
          {displayName ? `, ${displayName.split(" ")[0]}` : ""}! 🌿
        </div>
        <div style={{ fontSize: "14px", color: C.muted }}>
          {urgentCount === 0
            ? "Totul e la zi — nu ai acțiuni urgente astăzi."
            : `Ai ${urgentCount} ${urgentCount === 1 ? "acțiune urgentă" : "acțiuni urgente"} de făcut azi.`}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "28px",
        }}
      >
        {[
          {
            label: "Total contacte",
            value: contacts.length,
            color: C.dark,
            icon: "👥",
          },
          {
            label: "Prospecți activi",
            value: totalProspects,
            color: C.orange,
            icon: "🟡",
          },
          { label: "Clienți", value: totalClients, color: C.green, icon: "🟢" },
          {
            label: "Oferte trimise",
            value: recentOffers.length > 0 ? "5+" : "0",
            color: C.primary,
            icon: "📋",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: "14px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>
              {s.icon}
            </div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "28px",
                fontWeight: 600,
                color: s.color,
                marginBottom: "4px",
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: "11px", color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Urgent actions */}
      {urgentCount > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.dark,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "12px",
            }}
          >
            ⚡ Acțiuni urgente azi
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {/* Prospecți fără ofertă */}
            {needsOffer.length > 0 && (
              <div
                onClick={() => navigate("/app/contacts")}
                style={{
                  background: C.card,
                  border: `2px solid ${C.orange}33`,
                  borderLeft: `4px solid ${C.orange}`,
                  borderRadius: "0 12px 12px 0",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: C.dark,
                      marginBottom: "3px",
                    }}
                  >
                    {needsOffer.length}{" "}
                    {needsOffer.length === 1 ? "prospect" : "prospecți"} fără
                    ofertă
                  </div>
                  <div style={{ fontSize: "12px", color: C.muted }}>
                    {needsOffer
                      .slice(0, 3)
                      .map((c) => c.name || c.email.split("@")[0])
                      .join(", ")}
                    {needsOffer.length > 3
                      ? ` +${needsOffer.length - 3} alții`
                      : ""}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      background: C.orangebg,
                      color: C.orange,
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontWeight: 600,
                    }}
                  >
                    Trimite ofertă
                  </span>
                  <span style={{ color: C.muted, fontSize: "16px" }}>→</span>
                </div>
              </div>
            )}

            {/* Prospecți fără follow-up */}
            {needsFollowUp.length > 0 && (
              <div
                onClick={() => navigate("/app/contacts")}
                style={{
                  background: C.card,
                  border: `2px solid ${C.primary}33`,
                  borderLeft: `4px solid ${C.primary}`,
                  borderRadius: "0 12px 12px 0",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: C.dark,
                      marginBottom: "3px",
                    }}
                  >
                    ⏰ {needsFollowUp.length}{" "}
                    {needsFollowUp.length === 1 ? "prospect" : "prospecți"} fără
                    follow-up de {followUpDays}+ zile
                  </div>
                  <div style={{ fontSize: "12px", color: C.muted }}>
                    {needsFollowUp
                      .slice(0, 3)
                      .map((c) => {
                        const days = daysSince(c.last_offer_at);
                        return `${c.name || c.email.split("@")[0]} (${days}z)`;
                      })
                      .join(", ")}
                    {needsFollowUp.length > 3
                      ? ` +${needsFollowUp.length - 3} alții`
                      : ""}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      background: C.bg2,
                      color: C.primary,
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontWeight: 600,
                    }}
                  >
                    Follow-up
                  </span>
                  <span style={{ color: C.muted, fontSize: "16px" }}>→</span>
                </div>
              </div>
            )}

            {/* Clienți inactivi */}
            {inactive.length > 0 && (
              <div
                onClick={() => navigate("/app/contacts")}
                style={{
                  background: C.card,
                  border: `2px solid ${C.red}33`,
                  borderLeft: `4px solid ${C.red}`,
                  borderRadius: "0 12px 12px 0",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: C.dark,
                      marginBottom: "3px",
                    }}
                  >
                    😴 {inactive.length}{" "}
                    {inactive.length === 1 ? "client" : "clienți"} inactivi de{" "}
                    {inactiveDays}+ zile
                  </div>
                  <div style={{ fontSize: "12px", color: C.muted }}>
                    {inactive
                      .slice(0, 3)
                      .map((c) => c.name || c.email.split("@")[0])
                      .join(", ")}
                    {inactive.length > 3
                      ? ` +${inactive.length - 3} alții`
                      : ""}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      background: C.redbg,
                      color: C.red,
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontWeight: 600,
                    }}
                  >
                    Reactivează
                  </span>
                  <span style={{ color: C.muted, fontSize: "16px" }}>→</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All good state */}
      {urgentCount === 0 && contacts.length > 0 && (
        <div
          style={{
            background: C.greenbg,
            border: `1px solid rgba(46,138,88,0.2)`,
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "16px",
              color: C.green,
              marginBottom: "4px",
            }}
          >
            Totul e la zi!
          </div>
          <div style={{ fontSize: "13px", color: C.green }}>
            Nu ai acțiuni urgente pentru azi. Continuă să adaugi contacte noi.
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: C.dark,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "12px",
          }}
        >
          🚀 Acțiuni rapide
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "10px",
          }}
        >
          {[
            {
              label: "+ Contact nou",
              desc: "Salvează un prospect",
              icon: "👤",
              path: "/app/contacts",
              color: C.primary,
            },
            {
              label: "Ofertă nouă",
              desc: "Caută produse și trimite",
              icon: "🧮",
              path: "/app/calculator",
              color: C.green,
            },
            {
              label: "Vezi clienți",
              desc: "Gestionează relațiile",
              icon: "👥",
              path: "/app/contacts",
              color: C.orange,
            },
          ].map((a) => (
            <div
              key={a.label}
              onClick={() => navigate(a.path)}
              style={{
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "12px",
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                {a.icon}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: C.dark,
                  marginBottom: "3px",
                }}
              >
                {a.label}
              </div>
              <div style={{ fontSize: "11px", color: C.muted }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recentOffers.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.dark,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "12px",
            }}
          >
            🕐 Activitate recentă
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {recentOffers.map((offer, i) => (
              <div
                key={offer.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom:
                    i < recentOffers.length - 1
                      ? `1px solid ${C.border}`
                      : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: C.bg2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      color: C.primary,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {(offer.contacts?.name ||
                      offer.contacts?.email ||
                      "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: C.dark,
                      }}
                    >
                      Ofertă trimisă către{" "}
                      {offer.contacts?.name || offer.contacts?.email || "—"}
                    </div>
                    <div style={{ fontSize: "11px", color: C.muted }}>
                      {formatDate(offer.sent_at)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: C.primary,
                  }}
                >
                  {(offer.total_display || 0).toLocaleString("ro-RO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {offer.currency || "RON"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {contacts.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "16px",
            background: C.card,
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🌿</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "20px",
              color: C.dark,
              marginBottom: "8px",
            }}
          >
            Bun venit în AromaTool!
          </div>
          <div
            style={{
              fontSize: "13px",
              color: C.muted,
              marginBottom: "20px",
              maxWidth: "360px",
              margin: "0 auto 20px",
            }}
          >
            Începe prin a adăuga primul tău contact sau trimite o ofertă nouă.
          </div>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <button
              onClick={() => navigate("/app/contacts")}
              style={{
                padding: "10px 20px",
                background: `linear-gradient(135deg, ${C.primary}, #4A3270)`,
                border: "none",
                borderRadius: "10px",
                color: "white",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              + Adaugă contact
            </button>
            <button
              onClick={() => navigate("/app/calculator")}
              style={{
                padding: "10px 20px",
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                color: C.dark,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Ofertă nouă
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
