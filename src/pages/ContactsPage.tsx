import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSubscription } from "../lib/subscription";
import FollowupModal from "../components/FollowupModal";
import ContactModal from "../components/ContactModal";
import {
  getRecommendedAction,
  getActionType,
  displayStatus,
  shortReason,
  crmCategory,
  crmCategoryLabels,
  statusGroup,
} from "../lib/recommendedAction";
import type { CrmCategory } from "../lib/recommendedAction";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Contact } from "./DashboardPage";
import type { ContactStatus } from "../lib/relationshipScore";
import PhoneInput from "../components/PhoneInput";
import { openWhatsApp } from "../lib/contactActions";

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
  border: "#EDE8E0",
  white: "#FFFFFF",
  amber: "#C4906A",
  amberLight: "#FDF5EE",
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
  rose: "#D4A5A0",
  roseLight: "#FDF0EE",
};

// Status afișat → stil pin (cele 4 categorii curate)
function statusPill(status: string, t: TFunction): {
  label: string;
  bg: string;
  color: string;
} {
  const label = displayStatus(status as ContactStatus, t);
  switch (statusGroup(status as ContactStatus)) {
    case "prospect":
      return { label, bg: T.amberLight, color: T.amber };
    case "client":
      return { label, bg: T.greenLight, color: T.green };
    case "team":
      return { label, bg: T.lavenderLight, color: T.lavender };
    case "inactive":
      return { label, bg: T.linen, color: T.muted };
    default:
      return { label, bg: T.linen, color: T.muted };
  }
}

function daysSince(d?: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function relativeDays(d: string | null | undefined, t: TFunction): string {
  const n = daysSince(d);
  if (n === null) return "—";
  if (n === 0) return t("contacts.list.today");
  return t("contacts.list.daysAgo", { count: n });
}

// Eticheta scurtă a ultimei activități (ce s-a întâmplat ultima dată)
function lastActivityLabel(c: Contact, t: TFunction): string {
  const type = getActionType(c);
  // aproximare simplă bazată pe stare; panoul are istoricul complet
  if ((c.followup_count ?? 0) > 0 && type !== "needs_offer")
    return t("contacts.list.lastFollowupSent");
  if ((c.offers_count ?? 0) > 0) return t("contacts.list.lastOfferSent");
  return t("contacts.list.lastContactAdded");
}

function initials(name?: string | null, email?: string): string {
  return (name || email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Iconiță + culoare per acțiune recomandată (consistent cu Dashboard)
function actionVisual(c: Contact): { icon: string; color: string; bg: string } {
  const type = getActionType(c);
  switch (type) {
    case "needs_offer":
      return { icon: "ti-send", color: T.amber, bg: T.amberLight };
    case "needs_followup":
      return { icon: "ti-mail", color: T.amber, bg: T.amberLight };
    case "reactivate":
      return { icon: "ti-refresh", color: T.red, bg: T.redLight };
    case "discuss_business":
      return { icon: "ti-users-group", color: T.green, bg: T.greenLight };
    case "awaiting_reply":
      return { icon: "ti-clock", color: T.lavender, bg: T.lavenderLight };
    default:
      return { icon: "ti-circle-check", color: T.green, bg: T.greenLight };
  }
}

const BUSINESS_FILTERS: {
  key: string;
  match: (c: Contact) => boolean;
}[] = [
  { key: "all", match: () => true },
  { key: "prospect", match: (c) => statusGroup(c.status) === "prospect" },
  { key: "client", match: (c) => statusGroup(c.status) === "client" },
  { key: "team", match: (c) => statusGroup(c.status) === "team" },
  { key: "inactive", match: (c) => statusGroup(c.status) === "inactive" },
];

export default function ContactsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { requireAccess } = useSubscription();
  const navigate = useNavigate();

  const ACTION_OPTIONS: { key: "all" | CrmCategory; label: string }[] = [
    { key: "all", label: t("contacts.list.allLabel") },
    { key: "offer", label: crmCategoryLabels(t).offer },
    { key: "followup", label: crmCategoryLabels(t).followup },
    { key: "reactivate", label: crmCategoryLabels(t).reactivate },
    { key: "none", label: crmCategoryLabels(t).none },
  ];
  const [searchParams, setSearchParams] = useSearchParams();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | CrmCategory>("all");
  const [sortBy, setSortBy] = useState<"activity" | "name" | "value">(
    "activity",
  );
  const [prioritizeAttention, setPrioritizeAttention] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const [followupContact, setFollowupContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addData, setAddData] = useState({
    name: "",
    email: "",
    phone: "",
    source: "WhatsApp",
    reason: "",
    language: "ro",
  });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (user) loadContacts();
  }, [user]);

  // Citește ?filter= și ?new= din URL (vine din Dashboard)
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f) {
      if (f === "needs_attention") {
        setActionFilter("all");
        setPrioritizeAttention(true);
      } else if (["offer", "followup", "reactivate", "none"].includes(f)) {
        setActionFilter(f as CrmCategory);
      } else if (f === "needs_offer") {
        setActionFilter("offer");
      } else if (f === "needs_followup") {
        setActionFilter("followup");
      }
      searchParams.delete("filter");
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get("new") === "1") {
      setShowAddForm(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function loadContacts() {
    setLoading(true);
    const [{ data: ctcts }, { data: offersData }, { data: fuLog }] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("offers")
          .select("id,contact_id,total_eur,sent_at,products_json")
          .eq("user_id", user!.id)
          .order("sent_at", { ascending: false }),
        supabase
          .from("followup_log")
          .select("id,contact_id,sent_at,status")
          .eq("user_id", user!.id)
          .order("sent_at", { ascending: false }),
      ]);
    if (!ctcts) {
      setLoading(false);
      return;
    }

    const offers = offersData ?? [];
    const fu = fuLog ?? [];

    const enriched: Contact[] = ctcts.map((c: any) => {
      const cOffers = offers.filter((o) => o.contact_id === c.id);
      const cFu = fu.filter((f) => f.contact_id === c.id);
      const lastFollowupAt = cFu.length ? cFu[0].sent_at : null;
      const activityDates = [
        ...cOffers.map((o) => o.sent_at),
        ...cFu.map((f) => f.sent_at),
        c.updated_at,
      ].filter(Boolean) as string[];
      const lastActivityAt = activityDates.length
        ? activityDates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
        : null;
      const firstOfferAt = cOffers.length
        ? cOffers.reduce(
            (a, o) => (new Date(o.sent_at) < new Date(a) ? o.sent_at : a),
            cOffers[0].sent_at,
          )
        : (c.first_offer_at ?? null);
      // produse din oferte (pentru search)
      const offerProducts = cOffers.flatMap((o: any) =>
        (o.products_json ?? []).map((p: any) => p.name),
      );

      return {
        ...c,
        offers_count: cOffers.length,
        total_eur: cOffers.reduce((s, o) => s + (o.total_eur ?? 0), 0),
        last_activity_at: lastActivityAt,
        last_followup_at: lastFollowupAt,
        first_offer_at: firstOfferAt,
        offer_products: offerProducts,
      } as Contact;
    });
    setContacts(enriched);
    setLoading(false);
  }

  async function addContact() {
    if (!addData.name && !addData.email && !addData.phone) return;
    if (!requireAccess()) return;
    setAddSaving(true);
    const { data } = await supabase
      .from("contacts")
      .insert({
        user_id: user!.id,
        name: addData.name || null,
        email: addData.email || `${Date.now()}@noemail.local`,
        phone: addData.phone || null,
        status: "prospect",
        source: addData.source || null,
        notes: addData.reason || null,
        language_code: addData.language || "ro",
      })
      .select("*")
      .single();
    if (data) {
      setContacts((prev) => [
        {
          ...(data as Contact),
          offers_count: 0,
          total_eur: 0,
          last_activity_at: null,
        },
        ...prev,
      ]);
    }
    setAddData({
      name: "",
      email: "",
      phone: "",
      source: "WhatsApp",
      reason: "",
      language: "ro",
    });
    setShowAddForm(false);
    setAddSaving(false);
  }

  // Handlere slide panel (refolosesc logica din Dashboard)
  const handleStatusChange = async (
    contactId: string,
    newStatus: ContactStatus,
  ) => {
    await supabase
      .from("contacts")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", contactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus } : c)),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contactId ? { ...prev, status: newStatus } : prev,
    );
  };
  const handleNotesChange = async (contactId: string, notes: string) => {
    await supabase.from("contacts").update({ notes }).eq("id", contactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, notes } : c)),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contactId ? { ...prev, notes } : prev,
    );
  };

  const handleContactDelete = (contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setSelectedContact(null);
  };

  // WhatsApp — precompletăm mesajul (în limba contactului) ȘI logăm evenimentul,
  // exact ca pe Dashboard. Contează ca follow-up (alt canal de contact).
  const handleWhatsApp = async (c: Contact) => {
    const senderName = (user?.user_metadata as any)?.full_name as
      | string
      | undefined;
    // Deschidem WhatsApp cu mesajul precompletat (mic delay = pop-up permis după click).
    setTimeout(() => openWhatsApp(c, senderName), 50);

    const now = new Date().toISOString();
    const newCount = (c.followup_count ?? 0) + 1;
    const newStatus: ContactStatus =
      c.status === "prospect" ? "in_followup" : c.status;

    // Actualizare optimistă (followup_count/last_followup_at se derivă din followup_log
    // la următoarea încărcare — aici doar reflectăm imediat în UI).
    setContacts((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              last_activity_at: now,
              last_followup_at: now,
              followup_count: newCount,
              status: newStatus,
            }
          : x,
      ),
    );
    setSelectedContact((prev) =>
      prev && prev.id === c.id
        ? {
            ...prev,
            last_activity_at: now,
            last_followup_at: now,
            followup_count: newCount,
            status: newStatus,
          }
        : prev,
    );

    try {
      const { error: logErr } = await supabase.from("followup_log").insert({
        user_id: user!.id,
        contact_id: c.id,
        sent_at: now,
        status: "whatsapp_initiated",
      });
      if (logErr) console.error("Eroare followup_log:", logErr.message);

      const { error: ctErr } = await supabase
        .from("contacts")
        .update({ followup_count: newCount, status: newStatus })
        .eq("id", c.id);
      if (ctErr) console.error("Eroare contacts:", ctErr.message);
    } catch (e) {
      console.error("Eroare log WhatsApp:", e);
    }
  };

  // Filtrare + search + sortare
  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = contacts.filter((c) => {
      const bf = BUSINESS_FILTERS.find((f) => f.key === businessFilter);
      if (bf && !bf.match(c)) return false;
      if (actionFilter !== "all" && crmCategory(c) !== actionFilter)
        return false;
      if (q) {
        const hay = [
          c.name,
          c.email,
          c.phone,
          c.notes,
          c.source,
          ...(c.offer_products ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const attentionRank = (c: Contact): number => {
      const cat = crmCategory(c);
      if (cat === "reactivate") return 0;
      if (cat === "offer") return 1;
      if (cat === "followup") return 2;
      return 3;
    };

    list = [...list].sort((a, b) => {
      if (prioritizeAttention) {
        const ra = attentionRank(a);
        const rb = attentionRank(b);
        if (ra !== rb) return ra - rb;
      }
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "value") return (b.total_eur ?? 0) - (a.total_eur ?? 0);
      const da = a.last_activity_at
        ? new Date(a.last_activity_at).getTime()
        : 0;
      const db = b.last_activity_at
        ? new Date(b.last_activity_at).getTime()
        : 0;
      return db - da;
    });
    return list;
  }, [
    contacts,
    search,
    businessFilter,
    actionFilter,
    sortBy,
    prioritizeAttention,
  ]);

  const businessCounts = useMemo(() => {
    const m: Record<string, number> = {};
    BUSINESS_FILTERS.forEach((f) => {
      m[f.key] = contacts.filter(f.match).length;
    });
    return m;
  }, [contacts]);

  const actionCounts = useMemo(() => {
    const m: Record<string, number> = {
      all: contacts.length,
      offer: 0,
      followup: 0,
      reactivate: 0,
      none: 0,
    };
    contacts.forEach((c) => {
      m[crmCategory(c)]++;
    });
    return m;
  }, [contacts]);

  const activeActionLabel =
    ACTION_OPTIONS.find((o) => o.key === actionFilter)?.label ?? t("contacts.list.allLabel");
  const sortLabel =
    sortBy === "activity"
      ? t("contacts.list.sort.activity")
      : sortBy === "name"
        ? t("contacts.list.sort.name")
        : t("contacts.list.sort.value");

  const openContact = (c: Contact) => setSelectedContact(c);

  if (loading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px" }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: `3px solid ${T.border}`,
            borderTopColor: T.sage,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const GRID = "2.4fr 2.2fr 1fr 1.4fr 0.7fr 0.9fr";

  return (
    <div
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      onClick={() => {
        setActionMenuOpen(false);
        setSortMenuOpen(false);
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: T.espresso }}>
            {t("contacts.list.title")}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>
            {t("contacts.list.totalCount", { count: contacts.length })}
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 18px",
            background: T.sage,
            border: "none",
            borderRadius: 10,
            color: "white",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 15 }} />
          {t("contacts.list.newContact")}
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <i
          className="ti ti-search"
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 16,
            color: T.muted,
          }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("contacts.list.searchPlaceholder")}
          style={{
            width: "100%",
            padding: "11px 14px 11px 40px",
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: 12,
            fontSize: 14,
            color: T.espresso,
            fontFamily: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Un singur rând: filtre business (stânga) + dropdowns Acțiuni/Sortare (dreapta) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {BUSINESS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setBusinessFilter(f.key)}
            style={chipStyle(businessFilter === f.key, T.sage)}
          >
            {t(`contacts.list.filters.${f.key}`)}{" "}
            <span style={chipCount(businessFilter === f.key)}>
              {businessCounts[f.key] ?? 0}
            </span>
          </button>
        ))}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Dropdown Acțiuni */}
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setActionMenuOpen((v) => !v);
                setSortMenuOpen(false);
              }}
              style={dropdownBtn(actionFilter !== "all")}
            >
              <i className="ti ti-filter" style={{ fontSize: 14 }} />
              {t("contacts.list.actionsLabel", { value: activeActionLabel })}
              <i
                className={`ti ti-chevron-${actionMenuOpen ? "up" : "down"}`}
                style={{ fontSize: 14 }}
              />
            </button>
            {actionMenuOpen && (
              <div style={dropdownMenu}>
                {ACTION_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => {
                      setActionFilter(o.key);
                      setPrioritizeAttention(false);
                      setActionMenuOpen(false);
                    }}
                    style={dropdownItem(actionFilter === o.key)}
                  >
                    <span>{o.label}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>
                      {actionCounts[o.key] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Sortare */}
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setSortMenuOpen((v) => !v);
                setActionMenuOpen(false);
              }}
              style={dropdownBtn(false)}
            >
              <i className="ti ti-arrows-sort" style={{ fontSize: 14 }} />
              {t("contacts.list.sortLabel", { value: sortLabel })}
              <i
                className={`ti ti-chevron-${sortMenuOpen ? "up" : "down"}`}
                style={{ fontSize: 14 }}
              />
            </button>
            {sortMenuOpen && (
              <div style={dropdownMenu}>
                {(
                  [
                    ["activity", t("contacts.list.sort.activity")],
                    ["name", t("contacts.list.sort.name")],
                    ["value", t("contacts.list.sort.value")],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSortBy(k);
                      setPrioritizeAttention(false);
                      setSortMenuOpen(false);
                    }}
                    style={dropdownItem(sortBy === k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listă */}
      {visible.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: `1.5px dashed ${T.border}`,
            borderRadius: 16,
            background: T.white,
          }}
        >
          <i
            className="ti ti-users"
            style={{
              fontSize: 40,
              color: T.sageMid,
              display: "block",
              marginBottom: 12,
            }}
          />
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: T.espresso,
              marginBottom: 6,
            }}
          >
            {search || businessFilter !== "all" || actionFilter !== "all"
              ? t("contacts.list.noResults")
              : t("contacts.list.noContacts")}
          </div>
          <div style={{ fontSize: 13, color: T.muted }}>
            {t("contacts.list.emptyHint")}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: T.white,
            border: `0.5px solid ${T.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {/* Header tabel — ordine: Contact, Acțiune, Status, Ultima activitate, Oferte, Valoare */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 8,
              padding: "10px 16px 10px 16px",
              borderBottom: `0.5px solid ${T.border}`,
              background: T.cream,
            }}
          >
            {[
              t("contacts.list.colContact"),
              t("contacts.list.colAction"),
              t("contacts.list.colStatus"),
              t("contacts.list.colLastActivity"),
              t("contacts.list.colOffers"),
              t("contacts.list.colValue"),
            ].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: T.muted,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rânduri */}
          {visible.map((c, i) => {
            const action = getRecommendedAction(c, t);
            const reason = shortReason(c, t);
            const av = actionVisual(c);
            const pill = statusPill(c.status, t);
            return (
              <div
                key={c.id}
                onClick={() => openContact(c)}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 8,
                  padding: "12px 16px",
                  alignItems: "center",
                  cursor: "pointer",
                  borderBottom:
                    i < visible.length - 1 ? `0.5px solid ${T.border}` : "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = T.cream)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Contact */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: T.sageLight,
                      color: T.sage,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {initials(c.name, c.email)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: T.espresso,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.name || c.email}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      {c.phone || c.email}
                    </div>
                  </div>
                </div>

                {/* Acțiune recomandată — imediat după nume */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      flexShrink: 0,
                      background: av.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i
                      className={`ti ${av.icon}`}
                      style={{ fontSize: 17, color: av.color }}
                    />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: av.color,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {action.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.muted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {reason}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      background: pill.bg,
                      color: pill.color,
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pill.label}
                  </span>
                </div>

                {/* Ultima activitate */}
                <div>
                  <div style={{ fontSize: 13, color: T.espresso }}>
                    {relativeDays(c.last_activity_at, t)}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {lastActivityLabel(c, t)}
                  </div>
                </div>

                {/* Oferte */}
                <div style={{ fontSize: 13, color: T.espresso }}>
                  {c.offers_count ?? 0}
                </div>

                {/* Valoare */}
                <div style={{ fontSize: 13, fontWeight: 500, color: T.sage }}>
                  €{(c.total_eur ?? 0).toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>
        {t("contacts.list.shownCount", { count: visible.length })}
        {(search || businessFilter !== "all" || actionFilter !== "all") &&
          ` ${t("contacts.list.ofTotal", { count: contacts.length })}`}
      </div>

      {/* Modal profil contact */}
      <ContactModal
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onWhatsApp={handleWhatsApp}
        onEmail={(c) => {
          setSelectedContact(null);
          setFollowupContact(c);
        }}
        onOffer={(c) => {
          sessionStorage.setItem(
            "prefill_contact",
            JSON.stringify({
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              language: c.language_code ?? "ro",
            }),
          );
          navigate("/app/calculator");
        }}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
        onOpenOffer={(offerId: string) =>
          navigate(`/app/offers?offer=${offerId}`)
        }
        onContactUpdate={(updated) => {
          setContacts((prev) =>
            prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
          );
          setSelectedContact((prev) =>
            prev?.id === updated.id ? { ...prev, ...updated } : prev
          );
        }}
        onContactDelete={handleContactDelete}
      />

      {/* Follow-up modal */}
      {followupContact && (
        <FollowupModal
          contact={followupContact}
          action={getActionType(followupContact)}
          onClose={() => setFollowupContact(null)}
          onSent={(contactId: string) => {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === contactId
                  ? {
                      ...c,
                      followup_count: (c.followup_count || 0) + 1,
                      status:
                        c.status === "prospect" ? "in_followup" : c.status,
                    }
                  : c,
              ),
            );
            setFollowupContact(null);
          }}
        />
      )}

      {/* Add Contact Modal */}
      {showAddForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(61,53,48,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            style={{
              background: T.white,
              borderRadius: 20,
              padding: 28,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 60px rgba(60,53,48,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 500, color: T.espresso }}>
                {t("contacts.list.addForm.title")}
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: T.muted,
                  fontSize: 20,
                }}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.nameLabel")}</label>
                <input
                  value={addData.name}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder={t("contacts.list.addForm.namePlaceholder")}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.phoneLabel")}</label>
                <PhoneInput
                  value={addData.phone}
                  onChange={(v) => setAddData((p) => ({ ...p, phone: v }))}
                  theme={{
                    border: T.border,
                    inputBg: T.cream,
                    text: T.espresso,
                    focus: T.sage,
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.emailLabel")}</label>
                <input
                  value={addData.email}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder={t("contacts.list.addForm.emailPlaceholder")}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.sourceLabel")}</label>
                <select
                  value={addData.source}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, source: e.target.value }))
                  }
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Recomandare">{t("contacts.list.addForm.sourceRecomandare")}</option>
                  <option value="Altul">{t("contacts.list.addForm.sourceOther")}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.languageLabel")}</label>
                <select
                  value={addData.language}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, language: e.target.value }))
                  }
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="ro">{t("common.romanian")}</option>
                  <option value="en">{t("common.english")}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("contacts.list.addForm.reasonLabel")}</label>
                <textarea
                  value={addData.reason}
                  rows={3}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder={t("contacts.list.addForm.reasonPlaceholder")}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: 11,
                  background: T.linen,
                  border: `0.5px solid ${T.border}`,
                  borderRadius: 10,
                  color: T.espresso,
                  fontFamily: "inherit",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {t("contacts.common.cancel")}
              </button>
              <button
                onClick={addContact}
                disabled={
                  addSaving ||
                  (!addData.name && !addData.phone && !addData.email)
                }
                style={{
                  flex: 2,
                  padding: 11,
                  background: addSaving ? T.muted : T.sage,
                  border: "none",
                  borderRadius: 10,
                  color: "white",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {addSaving ? t("contacts.common.saving") : t("contacts.list.addForm.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: active ? color : T.white,
    border: `0.5px solid ${active ? color : T.border}`,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    color: active ? "white" : T.warm,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
function chipCount(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 500,
    background: active ? "rgba(255,255,255,0.25)" : T.linen,
    color: active ? "white" : T.muted,
    padding: "1px 7px",
    borderRadius: 999,
  };
}
function dropdownBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: active ? T.sageLight : T.white,
    border: `0.5px solid ${active ? T.sageMid : T.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: active ? T.sage : T.warm,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}
const dropdownMenu: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  minWidth: 200,
  background: T.white,
  border: `0.5px solid ${T.border}`,
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(61,53,48,0.12)",
  zIndex: 50,
  overflow: "hidden",
};
function dropdownItem(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "9px 14px",
    background: active ? T.cream : T.white,
    border: "none",
    borderBottom: `0.5px solid ${T.linen}`,
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    color: active ? T.sage : T.espresso,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
  };
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: "#6A5A50",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#FAFAF7",
  border: "0.5px solid #EDE8E0",
  borderRadius: 9,
  fontSize: 13,
  color: "#3D3530",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
