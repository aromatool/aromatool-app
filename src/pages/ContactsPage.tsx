import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import EnrollLink from "../components/EnrollLink";
import FollowupModal from "../components/FollowupModal";

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

const STATUSES = [
  { value: "prospect", label: "🟡 Prospect", bg: "#FFF8E7", color: "#B8860B" },
  {
    value: "client_nou",
    label: "🟢 Client nou",
    bg: C.greenbg,
    color: C.green,
  },
  {
    value: "client_fidel",
    label: "⭐ Client fidel",
    bg: C.bg2,
    color: C.primary,
  },
];

interface Contact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  first_offer_at: string | null;
  updated_at: string;
  offer_count?: number;
  total_eur?: number;
  last_offer_at?: string | null;
  followup_opted_out?: boolean;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysSince(d: string | null) {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [followupContact, setFollowupContact] = useState<Contact | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addData, setAddData] = useState({
    name: "",
    email: "",
    phone: "",
    source: "WhatsApp",
    reason: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(5);
  const [followupEnabled, setFollowupEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      loadContacts();
      loadProfile();
    }
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("follow_up_days, followup_enabled")
      .eq("id", user!.id)
      .single();
    if (data?.follow_up_days) setFollowUpDays(data.follow_up_days);
    if (data?.followup_enabled !== undefined)
      setFollowupEnabled(data.followup_enabled !== false);
  }

  async function addContact() {
    if (!addData.email && !addData.name) return;
    setAddSaving(true);
    const { data } = await supabase
      .from("contacts")
      .insert({
        user_id: user!.id,
        name: addData.name || null,
        email: addData.email || `${Date.now()}@noemail.local`,
        phone: addData.phone || null,
        status: "prospect",
        notes:
          [
            addData.source ? `Sursa: ${addData.source}` : "",
            addData.reason ? `Motiv: ${addData.reason}` : "",
          ]
            .filter(Boolean)
            .join(" | ") || null,
      })
      .select("*")
      .single();
    if (data) {
      setContacts((prev) => [
        { ...data, offer_count: 0, total_eur: 0, last_offer_at: null },
        ...prev,
      ]);
    }
    setAddData({ name: "", email: "", phone: "", source: "WhatsApp" });
    setShowAddForm(false);
    setAddSaving(false);
  }

  async function loadContacts() {
    setLoading(true);

    const { data: contactsData, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });

    if (error || !contactsData) {
      setLoading(false);
      return;
    }

    // Get offer stats per contact
    const { data: offersData } = await supabase
      .from("offers")
      .select("contact_id, total_eur, sent_at")
      .eq("user_id", user!.id);

    const statsMap: Record<
      string,
      { count: number; total: number; last: string }
    > = {};
    offersData?.forEach((o) => {
      if (!o.contact_id) return;
      if (!statsMap[o.contact_id])
        statsMap[o.contact_id] = { count: 0, total: 0, last: "" };
      statsMap[o.contact_id].count++;
      statsMap[o.contact_id].total += o.total_eur || 0;
      if (
        !statsMap[o.contact_id].last ||
        o.sent_at > statsMap[o.contact_id].last
      ) {
        statsMap[o.contact_id].last = o.sent_at;
      }
    });

    const enriched = contactsData.map((c) => ({
      ...c,
      offer_count: statsMap[c.id]?.count || 0,
      total_eur: statsMap[c.id]?.total || 0,
      last_offer_at: statsMap[c.id]?.last || null,
    }));

    setContacts(enriched);
    setLoading(false);
  }

  async function updateStatus(contactId: string, status: string) {
    await supabase.from("contacts").update({ status }).eq("id", contactId);
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status } : c)),
    );
  }

  async function toggleFollowupOptOut(
    contactId: string,
    currentValue: boolean,
  ) {
    const newValue = !currentValue;
    await supabase
      .from("contacts")
      .update({ followup_opted_out: newValue })
      .eq("id", contactId);
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, followup_opted_out: newValue } : c,
      ),
    );
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    await supabase
      .from("contacts")
      .update({
        name: editData.name,
        phone: editData.phone,
        notes: editData.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);
    setContacts((prev) =>
      prev.map((c) => (c.id === editingId ? { ...c, ...editData } : c)),
    );
    setEditingId(null);
    setSaving(false);
  }

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search.trim() ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      false;
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total: contacts.length,
    prospect: contacts.filter((c) => c.status === "prospect").length,
    client_nou: contacts.filter((c) => c.status === "client_nou").length,
    client_fidel: contacts.filter((c) => c.status === "client_fidel").length,
    totalEur: contacts.reduce((s, c) => s + (c.total_eur || 0), 0),
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "22px",
              color: C.dark,
            }}
          >
            Contacte
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: "8px 16px",
              background: `linear-gradient(135deg, ${C.primary}, #4A3270)`,
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            + Contact nou
          </button>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "Total", value: stats.total, color: C.dark },
            { label: "🟡 Prospecți", value: stats.prospect, color: "#B8860B" },
            { label: "🟢 Noi", value: stats.client_nou, color: C.green },
            { label: "⭐ Fideli", value: stats.client_fidel, color: C.primary },
            {
              label: "Valoare totală",
              value: `€ ${stats.totalEur.toFixed(0)}`,
              color: C.green,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                padding: "8px 14px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: C.muted,
                  marginBottom: "1px",
                }}
              >
                {s.label}
              </div>
              <div
                style={{ fontSize: "16px", fontWeight: 700, color: s.color }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
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
            placeholder="Caută după email sau nume..."
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              background: C.card,
              border: `1.5px solid ${C.border2}`,
              borderRadius: "10px",
              fontSize: "13px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            background: C.bg2,
            borderRadius: "10px",
            padding: "3px",
            gap: "2px",
          }}
        >
          {[
            { value: "all", label: "Toți" },
            ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                fontWeight: filterStatus === f.value ? 600 : 400,
                background: filterStatus === f.value ? "white" : "transparent",
                color: filterStatus === f.value ? C.dark : C.muted,
                boxShadow:
                  filterStatus === f.value
                    ? "0 1px 4px rgba(123,94,167,0.1)"
                    : "none",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts list */}
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
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>👥</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "18px",
              color: C.dark,
              marginBottom: "6px",
            }}
          >
            {search ? "Niciun rezultat" : "Nu ai clienți încă"}
          </div>
          <div style={{ fontSize: "13px", color: C.muted }}>
            Clienții apar automat când trimiți prima ofertă
          </div>
        </div>
      ) : (
        filtered.map((contact) => {
          const isExpanded = expandedId === contact.id;
          const isEditing = editingId === contact.id;
          const statusInfo =
            STATUSES.find((s) => s.value === contact.status) || STATUSES[0];
          const days = daysSince(contact.last_offer_at);
          const needsFollowUp =
            followupEnabled &&
            !contact.followup_opted_out &&
            contact.status === "prospect" &&
            days !== null &&
            days >= followUpDays;

          return (
            <div
              key={contact.id}
              style={{
                background: C.card,
                border: `1px solid ${needsFollowUp ? "rgba(184,134,11,0.4)" : C.border2}`,
                borderRadius: "14px",
                padding: "16px",
                marginBottom: "10px",
                borderLeft: needsFollowUp
                  ? "4px solid #B8860B"
                  : `1px solid ${C.border2}`,
              }}
            >
              {/* Main row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${C.primary}, #4A3270)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {(contact.name || contact.email)[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: C.dark,
                      }}
                    >
                      {contact.name || contact.email}
                    </span>
                    {contact.name && (
                      <span style={{ fontSize: "12px", color: C.muted }}>
                        {contact.email}
                      </span>
                    )}
                    {needsFollowUp && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#FFF8E7",
                          color: "#B8860B",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontWeight: 600,
                        }}
                      >
                        ⏰ Urmărire ({days}z)
                      </span>
                    )}
                    {contact.followup_opted_out && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: C.redbg,
                          color: C.red,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontWeight: 600,
                        }}
                      >
                        ⏸️ Follow-up oprit
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    {/* Status selector */}
                    <select
                      value={contact.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateStatus(contact.id, e.target.value);
                      }}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: `1px solid ${statusInfo.color}33`,
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    {contact.offer_count! > 0 && (
                      <span style={{ fontSize: "11px", color: C.muted }}>
                        📋 {contact.offer_count}{" "}
                        {contact.offer_count === 1 ? "ofertă" : "oferte"}
                      </span>
                    )}
                    {contact.total_eur! > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: C.green,
                          fontWeight: 500,
                        }}
                      >
                        € {contact.total_eur!.toFixed(2)}
                      </span>
                    )}
                    {contact.last_offer_at && (
                      <span style={{ fontSize: "11px", color: C.muted }}>
                        🕐 {formatDate(contact.last_offer_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {contact.phone && (
                    <button
                      onClick={() =>
                        window.open(
                          `https://wa.me/${contact.phone!.replace(/[^0-9]/g, "").replace(/^0/, "40")}`,
                          "_blank",
                        )
                      }
                      style={{
                        padding: "6px 10px",
                        background: "#25D366",
                        border: "none",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                      title="WhatsApp"
                    >
                      💬
                    </button>
                  )}
                  {!contact.followup_opted_out &&
                    contact.status !== "inactiv" && (
                      <button
                        onClick={() => setFollowupContact(contact)}
                        style={{
                          padding: "6px 10px",
                          background: needsFollowUp ? C.primary : C.bg2,
                          border: `1px solid ${needsFollowUp ? C.primary : C.border2}`,
                          borderRadius: "8px",
                          color: needsFollowUp ? "white" : C.dark,
                          fontSize: "12px",
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: needsFollowUp ? 600 : 400,
                        }}
                        title="Trimite follow-up"
                      >
                        📧
                      </button>
                    )}
                  <button
                    onClick={() =>
                      window.open(`mailto:${contact.email}`, "_blank")
                    }
                    style={{
                      padding: "6px 10px",
                      background: C.bg2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: "8px",
                      color: C.dark,
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    title="Email"
                  >
                    📧
                  </button>
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : contact.id)
                    }
                    style={{
                      padding: "6px 10px",
                      background: C.bg2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: "8px",
                      color: C.dark,
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
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
                  {isEditing ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "10px",
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Nume</label>
                          <input
                            value={editData.name || ""}
                            onChange={(e) =>
                              setEditData((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Nume Prenume"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Telefon (WhatsApp)</label>
                          <input
                            value={editData.phone || ""}
                            onChange={(e) =>
                              setEditData((p) => ({
                                ...p,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="+40712345678"
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Notițe</label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData((p) => ({
                              ...p,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Preferințe, informații utile..."
                          rows={3}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          style={{
                            flex: 1,
                            padding: "9px",
                            background: C.primary,
                            border: "none",
                            borderRadius: "9px",
                            color: "white",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          {saving ? "Se salvează..." : "✓ Salvează"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: "9px 16px",
                            background: C.bg2,
                            border: `1px solid ${C.border2}`,
                            borderRadius: "9px",
                            color: C.dark,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          Anulează
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "8px",
                          marginBottom: "12px",
                        }}
                      >
                        {[
                          { label: "Email", value: contact.email },
                          { label: "Telefon", value: contact.phone || "—" },
                          {
                            label: "Primul contact",
                            value: formatDate(contact.first_offer_at),
                          },
                          {
                            label: "Ultima ofertă",
                            value: formatDate(contact.last_offer_at || null),
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            style={{
                              background: C.bg2,
                              borderRadius: "8px",
                              padding: "8px 12px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                color: C.muted,
                                marginBottom: "2px",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {item.label}
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                color: C.dark,
                                fontWeight: 500,
                              }}
                            >
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>

                      {contact.notes && (
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
                          📝 {contact.notes}
                        </div>
                      )}

                      {/* Enroll Link */}
                      <EnrollLink
                        clientName={contact.name || undefined}
                        clientPhone={contact.phone || undefined}
                        compact={false}
                      />

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "12px",
                        }}
                      >
                        <button
                          onClick={() => {
                            setEditingId(contact.id);
                            setEditData({
                              name: contact.name,
                              phone: contact.phone,
                              notes: contact.notes,
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: "9px",
                            background: C.bg2,
                            border: `1px solid ${C.border2}`,
                            borderRadius: "9px",
                            color: C.dark,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          ✏️ Editează
                        </button>
                        <button
                          onClick={() =>
                            toggleFollowupOptOut(
                              contact.id,
                              contact.followup_opted_out || false,
                            )
                          }
                          style={{
                            flex: 1,
                            padding: "9px",
                            background: contact.followup_opted_out
                              ? C.redbg
                              : C.greenbg,
                            border: `1px solid ${contact.followup_opted_out ? "rgba(201,79,106,0.2)" : "rgba(46,138,88,0.2)"}`,
                            borderRadius: "9px",
                            color: contact.followup_opted_out ? C.red : C.green,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          {contact.followup_opted_out
                            ? "⏸️ Follow-up oprit"
                            : "✅ Follow-up activ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {/* Add Contact Modal */}
      {showAddForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(45,26,78,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            style={{
              background: C.card,
              borderRadius: "20px",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(45,26,78,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "20px",
                  color: C.dark,
                }}
              >
                Contact nou
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.muted,
                  fontSize: "20px",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={labelStyle}>Nume</label>
                <input
                  value={addData.name}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Nume Prenume"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>Telefon (WhatsApp)</label>
                <input
                  value={addData.phone}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+40712345678"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email (opțional)</label>
                <input
                  type="email"
                  value={addData.email}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="email@client.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>De unde vine?</label>
                <select
                  value={addData.source}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, source: e.target.value }))
                  }
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="WhatsApp">💬 WhatsApp</option>
                  <option value="Facebook">👤 Facebook</option>
                  <option value="Instagram">📸 Instagram</option>
                  <option value="Recomandare">🤝 Recomandare</option>
                  <option value="Altul">✨ Altul</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>
                  Motivul contactului / afecțiune
                </label>
                <textarea
                  value={addData.reason}
                  rows={3}
                  onChange={(e) =>
                    setAddData((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder="ex: Vrea ulei de lavandă pentru somn, are probleme cu stresul, a văzut postarea de pe Instagram..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <div
                  style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}
                >
                  Aceste informații te ajută să personalizezi oferta și
                  follow-up-ul
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: "11px",
                  background: C.bg2,
                  border: `1px solid ${C.border2}`,
                  borderRadius: "10px",
                  color: C.dark,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Anul
              </button>
              <button
                onClick={addContact}
                disabled={
                  addSaving ||
                  (!addData.name && !addData.email && !addData.phone)
                }
                style={{
                  flex: 2,
                  padding: "11px",
                  background: addSaving
                    ? C.muted
                    : `linear-gradient(135deg, ${C.primary}, #4A3270)`,
                  border: "none",
                  borderRadius: "10px",
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: addSaving ? "not-allowed" : "pointer",
                }}
              >
                {addSaving ? "Se salvează..." : "+ Adaugă contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {followupContact && (
        <FollowupModal
          contact={followupContact}
          onClose={() => setFollowupContact(null)}
          onSent={(contactId) => {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === contactId
                  ? {
                      ...c,
                      followup_count: (c.followup_count || 0) + 1,
                      status: "in_followup",
                    }
                  : c,
              ),
            );
            setFollowupContact(null);
          }}
        />
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: "#6B5B9E",
  marginBottom: "5px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#F9F7FF",
  border: "1.5px solid rgba(196,168,232,0.4)",
  borderRadius: "9px",
  fontSize: "13px",
  color: "#2D1A4E",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
