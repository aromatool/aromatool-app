import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getRecommendedAction, displayStatus } from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";
import type { Contact } from "../pages/DashboardPage";
import PhoneInput from "./PhoneInput";

interface OfferRow {
  id: string;
  sent_at: string;
  total_eur: number;
  products: string[];
  status?: string | null;
}
interface TimelineItem {
  date: string;
  time: string;
  label: string;
  sub: string;
  type: "offer" | "email" | "whatsapp" | "followup" | "event";
  amount?: string;
  offerId?: string;
}

interface Props {
  contact: Contact | null;
  onClose: () => void;
  onWhatsApp?: (c: Contact) => void;
  onEmail?: (c: Contact) => void;
  onOffer?: (c: Contact) => void;
  onStatusChange?: (id: string, s: ContactStatus) => Promise<void> | void;
  onNotesChange?: (id: string, notes: string) => Promise<void> | void;
  onOpenOffer?: (offerId: string) => void;
  onContactUpdate?: (updated: Contact) => void;
  onContactDelete?: (id: string) => void;
}

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
  amberBorder: "#E8C8A8",
  lavender: "#9888B8",
  lavenderLight: "#F0EEF8",
  lavBorder: "#DDD8F0",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
  rose: "#D4A5A0",
  roseLight: "#FDF0EE",
};

function daysSince(d?: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function initials(name?: string | null, email?: string): string {
  return (name || email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status: string) {
  const shown = displayStatus(status as ContactStatus);
  switch (shown) {
    case "Prospect":
      return { label: "Prospect", bg: T.amberLight, color: T.amber };
    case "Client":
      return { label: "Client", bg: T.greenLight, color: T.green };
    case "Membru echipă":
      return { label: "Membru echipă", bg: T.lavenderLight, color: T.lavender };
    case "Inactiv":
      return { label: "Inactiv", bg: T.linen, color: T.muted };
    default:
      return { label: shown, bg: T.linen, color: T.muted };
  }
}
const TIMELINE_VISUAL: Record<
  string,
  { icon: string; bg: string; color: string }
> = {
  offer: { icon: "ti-file-text", bg: T.greenLight, color: T.green },
  email: { icon: "ti-mail", bg: T.lavenderLight, color: T.lavender },
  followup: { icon: "ti-mail-forward", bg: T.lavenderLight, color: T.lavender },
  whatsapp: { icon: "ti-brand-whatsapp", bg: "#EAF8EF", color: "#3DAE6E" },
  event: { icon: "ti-user-plus", bg: T.linen, color: T.muted },
};
const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "client_nou", label: "Client" },
  { value: "team_member", label: "Membru echipă" },
  { value: "inactiv", label: "Inactiv" },
];

type Tab = "offers" | "products" | "tracking";

export default function ContactModal({
  contact,
  onClose,
  onWhatsApp,
  onEmail,
  onOffer,
  onStatusChange,
  onNotesChange,
  onOpenOffer,
  onContactUpdate,
  onContactDelete,
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("offers");
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({ name: "", phone: "", email: "", source: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingComm, setSavingComm] = useState<"email_opt_out" | "communication_blocked" | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    setTab("offers");
    setEditingNotes(false);
    setStatusMenuOpen(false);
    setShowAllTimeline(false);
    setEditMode(false);
    setMoreMenuOpen(false);
    setDeleteConfirm(false);
    setNotesDraft(contact?.notes ?? "");
    if (contact) loadData(contact);
  }, [contact?.id]);

  async function loadData(c: Contact) {
    setLoading(true);
    const [{ data: offData }, { data: fuData }] = await Promise.all([
      supabase
        .from("offers")
        .select("id,sent_at,total_eur,products_json")
        .eq("user_id", user!.id)
        .eq("contact_id", c.id)
        .order("sent_at", { ascending: false }),
      supabase
        .from("followup_log")
        .select("id,sent_at,status")
        .eq("user_id", user!.id)
        .eq("contact_id", c.id)
        .order("sent_at", { ascending: false }),
    ]);

    const offerRows: OfferRow[] = (offData ?? []).map((o: any) => ({
      id: o.id,
      sent_at: o.sent_at,
      total_eur: o.total_eur ?? 0,
      products: (o.products_json ?? []).map((p: any) => p.name),
      status: o.status,
    }));
    setOffers(offerRows);

    const events: (TimelineItem & { sortKey: number })[] = [];
    offerRows.forEach((o, idx) => {
      events.push({
        date: fmtDate(o.sent_at),
        time: fmtTime(o.sent_at),
        sortKey: new Date(o.sent_at).getTime(),
        label: "Ofertă trimisă",
        sub: `Oferta #${offerRows.length - idx} · €${o.total_eur.toFixed(0)}`,
        type: "offer",
        amount: `€${o.total_eur.toFixed(0)}`,
        offerId: o.id,
      });
    });
    (fuData ?? []).forEach((f: any) => {
      const st = f.status;
      const type =
        st === "whatsapp_initiated"
          ? "whatsapp"
          : st === "sent"
            ? "email"
            : "followup";
      const label =
        st === "whatsapp_initiated"
          ? "WhatsApp trimis"
          : st === "sent"
            ? "Email trimis"
            : "Follow-up trimis";
      const sub =
        st === "whatsapp_initiated"
          ? "Mesaj WhatsApp"
          : st === "sent"
            ? "Email trimis"
            : "Follow-up";
      events.push({
        date: fmtDate(f.sent_at),
        time: fmtTime(f.sent_at),
        sortKey: new Date(f.sent_at).getTime(),
        label,
        sub,
        type,
      });
    });
    events.push({
      date: fmtDate(c.created_at),
      time: fmtTime(c.created_at),
      sortKey: new Date(c.created_at).getTime(),
      label: "Contact creat",
      sub: "Adăugat manual",
      type: "event",
    });
    events.sort((a, b) => b.sortKey - a.sortKey);
    setTimeline(events.map(({ sortKey, ...rest }) => rest));
    setLoading(false);
  }

  const productCounts = useMemo(() => {
    const m: Record<string, number> = {};
    offers.forEach((o) =>
      o.products.forEach((p) => {
        m[p] = (m[p] ?? 0) + 1;
      }),
    );
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [offers]);

  if (!contact) return null;

  const action = getRecommendedAction(contact);
  const inCRM = daysSince(contact.created_at);
  const lastContact = daysSince(
    contact.last_activity_at ?? contact.first_offer_at,
  );
  const pill = statusPill(contact.status);

  const handleStatusSelect = async (s: ContactStatus) => {
    if (displayStatus(s) === displayStatus(contact.status)) {
      setStatusMenuOpen(false);
      return;
    }
    setChangingStatus(true);
    try {
      await onStatusChange?.(contact.id, s);
    } finally {
      setChangingStatus(false);
      setStatusMenuOpen(false);
    }
  };
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onNotesChange?.(contact.id, notesDraft);
    } finally {
      setSavingNotes(false);
      setEditingNotes(false);
    }
  };

  const handleToggleEmailOptOut = async (newValue: boolean) => {
    setSavingComm("email_opt_out");
    const updates: Record<string, unknown> = {
      email_opt_out: newValue,
      email_opt_out_at: newValue ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("contacts").update(updates).eq("id", contact!.id);
    if (!error) onContactUpdate?.({ ...contact!, ...updates });
    setSavingComm(null);
  };

  const handleToggleCommunicationBlocked = async (newValue: boolean) => {
    setSavingComm("communication_blocked");
    const updates: Record<string, unknown> = {
      communication_blocked: newValue,
      communication_blocked_at: newValue ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("contacts").update(updates).eq("id", contact!.id);
    if (!error) onContactUpdate?.({ ...contact!, ...updates });
    setSavingComm(null);
  };

  const handleDeleteContact = async () => {
    setDeleting(true);
    await supabase.from("contacts").delete().eq("id", contact!.id);
    onContactDelete?.(contact!.id);
    onClose();
  };

  const handleStartEdit = () => {
    const isPlaceholder = (contact.email ?? "").includes("@noemail.local");
    setEditDraft({
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      email: isPlaceholder ? "" : (contact.email ?? ""),
      source: contact.source ?? "",
    });
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const updates: Record<string, string | null> = {
      name: editDraft.name.trim() || null,
      phone: editDraft.phone.trim() || null,
      source: editDraft.source.trim() || null,
    };
    if (editDraft.email.trim()) updates.email = editDraft.email.trim();
    const { error } = await supabase.from("contacts").update(updates).eq("id", contact.id);
    if (!error) {
      onContactUpdate?.({ ...contact, ...updates });
      setEditMode(false);
    }
    setSavingEdit(false);
  };

  const visibleTimeline = showAllTimeline ? timeline : timeline.slice(0, 6);

  const isBlocked = !!contact.communication_blocked;
  const isEmailOptOut = !!contact.email_opt_out;

  // CTA principal după tipul acțiunii
  const primaryCTA =
    action.type === "needs_offer"
      ? {
          label: "Creează ofertă",
          icon: "ti-file-text",
          onClick: () => onOffer?.(contact),
          color: action.accentColor,
        }
      : action.type === "none" || action.type === "reactivate"
        ? {
            label: "Trimite mesaj",
            icon: "ti-brand-whatsapp",
            onClick: () => onWhatsApp?.(contact),
            color: T.green,
          }
        : {
            label: "Trimite email",
            icon: "ti-mail",
            onClick: () => onEmail?.(contact),
            color: T.sage,
          };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(61,53,48,0.4)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3vh 2vw",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setStatusMenuOpen(false);
        }}
        style={{
          background: T.white,
          borderRadius: 18,
          width: "min(1240px, 95vw)",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(61,53,48,0.25)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: `0.5px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              flexShrink: 0,
              background: T.sageLight,
              color: T.sage,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            {initials(contact.name, contact.email)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{ fontSize: 22, fontWeight: 600, color: T.espresso }}
              >
                {contact.name || contact.email}
              </span>
              <span
                style={{
                  fontSize: 12,
                  background: pill.bg,
                  color: pill.color,
                  padding: "3px 11px",
                  borderRadius: 999,
                  fontWeight: 500,
                }}
              >
                {pill.label}
              </span>
              {contact.source && (
                <span
                  style={{
                    fontSize: 12,
                    color: T.warm,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <i
                    className="ti ti-brand-instagram"
                    style={{ fontSize: 13 }}
                  />{" "}
                  {contact.source}
                </span>
              )}
              {inCRM !== null && (
                <span style={{ fontSize: 12, color: T.muted }}>
                  · în CRM de {inCRM} zile
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 13,
                color: T.muted,
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {contact.phone && (
                <span>
                  <i
                    className="ti ti-phone"
                    style={{ fontSize: 13, marginRight: 4 }}
                  />
                  {contact.phone}
                </span>
              )}
              {contact.phone && contact.email && <span>·</span>}
              {contact.email && (
                <span>
                  <i
                    className="ti ti-mail"
                    style={{ fontSize: 13, marginRight: 4 }}
                  />
                  {contact.email}
                </span>
              )}
            </div>
          </div>
          {editMode ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ ...hdrBtn(), background: T.sage, color: "#fff", border: "none" }}
              >
                <i className="ti ti-check" style={{ fontSize: 15 }} />
                {savingEdit ? "Se salvează..." : "Salvează"}
              </button>
              <button onClick={() => setEditMode(false)} style={hdrBtn()}>
                <i className="ti ti-x" style={{ fontSize: 15 }} /> Anulează
              </button>
            </div>
          ) : (
            <button onClick={handleStartEdit} style={hdrBtn()}>
              <i className="ti ti-edit" style={{ fontSize: 15 }} /> Editează contact
            </button>
          )}
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setStatusMenuOpen((v) => !v)}
              disabled={changingStatus}
              style={hdrBtn()}
            >
              <span>Schimbă status</span>
              <i
                className={`ti ti-chevron-${statusMenuOpen ? "up" : "down"}`}
                style={{ fontSize: 14 }}
              />
            </button>
            {statusMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  minWidth: 180,
                  background: T.white,
                  border: `0.5px solid ${T.border}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(61,53,48,.12)",
                  zIndex: 20,
                  overflow: "hidden",
                }}
              >
                {STATUS_OPTIONS.map((o) => {
                  const active =
                    displayStatus(o.value) === displayStatus(contact.status);
                  return (
                    <button
                      key={o.value}
                      onClick={() => handleStatusSelect(o.value)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: active ? T.cream : T.white,
                        border: "none",
                        borderBottom: `0.5px solid ${T.linen}`,
                        padding: "10px 14px",
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                        color: T.espresso,
                      }}
                    >
                      {o.label}
                      {active && (
                        <i
                          className="ti ti-check"
                          style={{ fontSize: 14, color: T.sage }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Mai multe (⋯) — conține Delete definitiv */}
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMoreMenuOpen((v) => !v)}
              title="Mai multe"
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: T.white,
                border: `0.5px solid ${T.border}`,
                cursor: "pointer",
                color: T.warm,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className="ti ti-dots" style={{ fontSize: 17 }} />
            </button>
            {moreMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  minWidth: 180,
                  background: T.white,
                  border: `0.5px solid ${T.border}`,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(61,53,48,.12)",
                  zIndex: 30,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setDeleteConfirm(true);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: T.white,
                    border: "none",
                    padding: "10px 14px",
                    fontSize: 13,
                    color: T.red,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <i className="ti ti-trash" style={{ fontSize: 15 }} />
                  Șterge definitiv
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: T.linen,
              border: "none",
              cursor: "pointer",
              color: T.warm,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* ALERTĂ BLOCAT — banner imediat sub header, înainte de scroll body */}
        {isBlocked && (
          <div
            style={{
              background: T.redLight,
              borderBottom: `0.5px solid rgba(201,79,106,0.25)`,
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: T.red,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            <i className="ti ti-ban" style={{ fontSize: 16, flexShrink: 0 }} />
            Acest contact nu dorește să mai fie contactat. Acțiunile de comunicare sunt dezactivate.
          </div>
        )}
        {isEmailOptOut && !isBlocked && (
          <div
            style={{
              background: "#FDF5EE",
              borderBottom: `0.5px solid rgba(196,144,106,0.25)`,
              padding: "8px 24px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#C4906A",
              flexShrink: 0,
            }}
          >
            <i className="ti ti-mail-off" style={{ fontSize: 14, flexShrink: 0 }} />
            Email dezactivat — contactul nu mai primește emailuri.
          </div>
        )}

        {/* DIALOG CONFIRMARE ȘTERGERE */}
        {deleteConfirm && (
          <div
            onClick={() => setDeleteConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(61,53,48,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: T.white,
                borderRadius: 16,
                padding: 28,
                maxWidth: 400,
                width: "100%",
                boxShadow: "0 20px 60px rgba(61,53,48,.25)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: T.redLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: 22, color: T.red }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: T.espresso, marginBottom: 8 }}>
                Șterge definitiv contactul?
              </div>
              <div style={{ fontSize: 13, color: T.warm, lineHeight: 1.6, marginBottom: 6 }}>
                Vei șterge <strong>{contact.name || contact.email}</strong> împreună cu toate ofertele și istoricul asociat.
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.red,
                  fontWeight: 500,
                  background: T.redLight,
                  border: `0.5px solid rgba(201,79,106,0.25)`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 20,
                }}
              >
                <i className="ti ti-alert-triangle" style={{ fontSize: 13, marginRight: 5 }} />
                Această acțiune nu poate fi anulată.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleDeleteContact}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: T.red,
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: deleting ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {deleting
                    ? <><i className="ti ti-loader-2" style={{ fontSize: 14 }} /> Se șterge...</>
                    : <><i className="ti ti-trash" style={{ fontSize: 14 }} /> Șterge definitiv</>
                  }
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: T.linen,
                    border: `0.5px solid ${T.border}`,
                    borderRadius: 10,
                    color: T.warm,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Anulează
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCROLL BODY */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            background: T.cream,
          }}
        >
          {/* FORMULAR EDITARE */}
          {editMode && (
            <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 24, maxWidth: 520 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.espresso, marginBottom: 20 }}>
                Editează informații contact
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { key: "name", label: "Nume", icon: "ti-user", placeholder: "Numele contactului" },
                  { key: "phone", label: "Telefon", icon: "ti-phone", placeholder: "ex: 0722 123 456" },
                  { key: "email", label: "Email", icon: "ti-mail", placeholder: "adresa@email.com" },
                  { key: "source", label: "Sursă", icon: "ti-map-pin", placeholder: "ex: Instagram, recomandare" },
                ].map(({ key, label, icon, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      <i className={`ti ${icon}`} style={{ fontSize: 13 }} /> {label}
                    </label>
                    {key === "phone" ? (
                      <PhoneInput
                        value={editDraft.phone}
                        onChange={(v) => setEditDraft((prev) => ({ ...prev, phone: v }))}
                        theme={{
                          border: T.border,
                          inputBg: T.white,
                          text: T.espresso,
                          focus: T.sage,
                        }}
                      />
                    ) : (
                      <input
                        type={key === "email" ? "email" : "text"}
                        value={editDraft[key as keyof typeof editDraft]}
                        onChange={(e) => setEditDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: 14,
                          color: T.espresso,
                          border: `0.5px solid ${T.border}`,
                          borderRadius: 9,
                          outline: "none",
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                          background: T.white,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  style={{ background: T.sage, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {savingEdit ? "Se salvează..." : "Salvează modificările"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  style={{ background: T.linen, color: T.warm, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Anulează
                </button>
              </div>
            </div>
          )}

          {/* RÂND 1: Acțiune recomandată + KPI-uri */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1.7fr",
              gap: 16,
            }}
          >
            {/* Acțiune recomandată */}
            <div
              style={{
                background: action.accentBg,
                border: `0.5px solid ${action.accentColor}33`,
                borderRadius: 14,
                padding: "14px 20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: action.accentColor,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <i className="ti ti-send" style={{ fontSize: 13 }} /> Acțiune
                recomandată
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: T.espresso }}>
                {action.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: T.warm,
                  marginTop: 3,
                  marginBottom: 12,
                }}
              >
                {action.reason}
              </div>
              {isBlocked ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 14px",
                    background: T.redLight,
                    border: `0.5px solid rgba(201,79,106,0.25)`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: T.red,
                    fontWeight: 500,
                  }}
                >
                  <i className="ti ti-ban" style={{ fontSize: 14 }} />
                  Comunicare blocată — acțiunile sunt dezactivate
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={primaryCTA.onClick}
                    disabled={isEmailOptOut && primaryCTA.icon === "ti-mail"}
                    title={isEmailOptOut && primaryCTA.icon === "ti-mail" ? "Email dezactivat pentru acest contact" : undefined}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "11px 18px",
                      background: (isEmailOptOut && primaryCTA.icon === "ti-mail") ? "#ccc" : primaryCTA.color,
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#fff",
                      cursor: (isEmailOptOut && primaryCTA.icon === "ti-mail") ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: (isEmailOptOut && primaryCTA.icon === "ti-mail") ? 0.6 : 1,
                    }}
                  >
                    <i className={`ti ${primaryCTA.icon}`} style={{ fontSize: 16 }} />{" "}
                    {primaryCTA.label}
                  </button>
                  {primaryCTA.icon !== "ti-brand-whatsapp" && (
                    <button onClick={() => onWhatsApp?.(contact)} style={ghostBtn()}>
                      <i className="ti ti-brand-whatsapp" style={{ fontSize: 15 }} />{" "}
                      WhatsApp
                    </button>
                  )}
                  <button onClick={() => onOffer?.(contact)} style={ghostBtn()}>
                    <i className="ti ti-file-text" style={{ fontSize: 15 }} />{" "}
                    Ofertă nouă
                  </button>
                </div>
              )}
            </div>

            {/* KPI-uri */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
              }}
            >
              <Kpi
                icon="ti-file-text"
                iconBg={T.sageLight}
                iconColor={T.sage}
                value={String(contact.offers_count ?? 0)}
                label="Oferte trimise"
              />
              <Kpi
                icon="ti-currency-euro"
                iconBg={T.amberLight}
                iconColor={T.amber}
                value={`€${(contact.total_eur ?? 0).toFixed(0)}`}
                label="Valoare totală"
                valueColor={T.green}
              />
              <Kpi
                icon="ti-clock"
                iconBg={T.lavenderLight}
                iconColor={T.lavender}
                value={lastContact !== null ? `${lastContact} zile` : "—"}
                label="Ultimul contact"
              />
              <Kpi
                icon="ti-refresh"
                iconBg={T.roseLight}
                iconColor={T.rose}
                value={String(contact.followup_count ?? 0)}
                label="Follow-up-uri"
              />
            </div>
          </div>

          {/* RÂND 2: 2 coloane — stânga info+notițe, dreapta istoric */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* STÂNGA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title="Informații contact">
                <InfoRow
                  icon="ti-phone"
                  label="Telefon"
                  value={contact.phone || "—"}
                />
                <InfoRow
                  icon="ti-mail"
                  label="Email"
                  value={contact.email || "—"}
                />
                {contact.source && (
                  <InfoRow
                    icon="ti-map-pin"
                    label="Sursă"
                    value={contact.source}
                  />
                )}
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <i
                    className="ti ti-tag"
                    style={{ fontSize: 16, color: T.muted, marginTop: 1 }}
                  />
                  <div>
                    <div style={{ fontSize: 11, color: T.muted }}>Status</div>
                    <span
                      style={{
                        fontSize: 12,
                        background: pill.bg,
                        color: pill.color,
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontWeight: 500,
                        display: "inline-block",
                        marginTop: 2,
                      }}
                    >
                      {pill.label}
                    </span>
                  </div>
                </div>
                <InfoRow
                  icon="ti-calendar"
                  label="Data creării"
                  value={fmtDate(contact.created_at)}
                />
              </Card>

              {/* Notițe — secțiune importantă, mai mare și mai lizibilă */}
              <div
                style={{
                  background:
                    contact.notes && !editingNotes ? T.amberLight : T.white,
                  border: `0.5px solid ${contact.notes && !editingNotes ? T.amberBorder : T.border}`,
                  borderRadius: 14,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: T.espresso,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i
                      className="ti ti-note"
                      style={{ fontSize: 16, color: T.amber }}
                    />{" "}
                    Notițe
                  </span>
                  {!editingNotes && (
                    <button
                      onClick={() => {
                        setNotesDraft(contact.notes ?? "");
                        setEditingNotes(true);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 500,
                        color: T.sage,
                        background: T.white,
                        border: `0.5px solid ${T.sageMid}`,
                        borderRadius: 8,
                        padding: "6px 12px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <i className="ti ti-edit" style={{ fontSize: 14 }} />{" "}
                      Editează
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      autoFocus
                      rows={6}
                      placeholder="Scrie o notiță despre acest contact..."
                      style={{
                        width: "100%",
                        fontSize: 14,
                        color: T.espresso,
                        lineHeight: 1.7,
                        fontFamily: "inherit",
                        border: `0.5px solid ${T.sageMid}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        resize: "vertical",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        style={{
                          background: T.sage,
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {savingNotes ? "Se salvează..." : "Salvează"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(false);
                          setNotesDraft(contact.notes ?? "");
                        }}
                        style={{
                          background: T.linen,
                          color: T.warm,
                          border: `0.5px solid ${T.border}`,
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Anulează
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: contact.notes ? T.espresso : T.muted,
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                      minHeight: 48,
                    }}
                  >
                    {contact.notes ||
                      "Nicio notiță încă. Adaugă context despre acest contact."}
                  </div>
                )}
              </div>

              {/* Preferințe comunicare */}
              <div
                style={{
                  background: T.white,
                  border: `0.5px solid ${isBlocked ? "rgba(201,79,106,0.3)" : T.border}`,
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: T.espresso,
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className="ti ti-settings" style={{ fontSize: 15, color: T.muted }} />
                  Preferințe comunicare
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Email opt-out toggle */}
                  <CommToggle
                    label="Emailuri"
                    description={isEmailOptOut ? "Dezactivat" : "Activ"}
                    checked={!isEmailOptOut}
                    disabled={isBlocked || savingComm === "email_opt_out"}
                    onChange={(val) => handleToggleEmailOptOut(!val)}
                    dangerOff
                  />
                  {/* Communication blocked toggle */}
                  <CommToggle
                    label="Comunicare completă"
                    description={isBlocked ? "Blocată" : "Permisă"}
                    checked={!isBlocked}
                    disabled={savingComm === "communication_blocked"}
                    onChange={(val) => handleToggleCommunicationBlocked(!val)}
                    dangerOff
                  />
                  {isBlocked && (
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                      Contactul nu va mai apărea în acțiunile de zi și agenda săptămânii.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DREAPTA: Istoric activități */}
            <Card title="Istoric activități">
              {loading ? (
                <Empty icon="ti-loader" text="Se încarcă..." />
              ) : timeline.length === 0 ? (
                <Empty icon="ti-history" text="Niciun eveniment încă." />
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    {visibleTimeline.map((item, i) => {
                      const v = TIMELINE_VISUAL[item.type];
                      const clickable = item.type === "offer" && item.offerId;
                      const isLast = i === visibleTimeline.length - 1;
                      return (
                        <div
                          key={i}
                          onClick={() =>
                            clickable && onOpenOffer?.(item.offerId!)
                          }
                          style={{
                            display: "flex",
                            gap: 14,
                            cursor: clickable ? "pointer" : "default",
                          }}
                        >
                          {/* Coloană iconiță + linie */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: v.bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <i
                                className={`ti ${v.icon}`}
                                style={{ fontSize: 17, color: v.color }}
                              />
                            </div>
                            {!isLast && (
                              <div
                                style={{
                                  width: 1.5,
                                  flex: 1,
                                  minHeight: 20,
                                  background: T.border,
                                  margin: "4px 0",
                                }}
                              />
                            )}
                          </div>
                          {/* Conținut */}
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              paddingBottom: isLast ? 0 : 16,
                            }}
                          >
                            <div style={{ fontSize: 11, color: T.muted }}>
                              {item.date} · {item.time}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 2,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: clickable ? T.sage : T.espresso,
                                }}
                              >
                                {item.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  color: item.amount ? T.green : T.muted,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.sub}
                                {clickable && (
                                  <i
                                    className="ti ti-chevron-right"
                                    style={{ fontSize: 14 }}
                                  />
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {timeline.length > 6 && (
                    <button
                      onClick={() => setShowAllTimeline((v) => !v)}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "10px",
                        background: "none",
                        border: "none",
                        color: T.sage,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                      }}
                    >
                      {showAllTimeline ? "Arată mai puține" : "Vezi mai multe"}{" "}
                      <i
                        className={`ti ti-chevron-${showAllTimeline ? "up" : "down"}`}
                        style={{ fontSize: 15 }}
                      />
                    </button>
                  )}
                </>
              )}
            </Card>
          </div>

          {/* RÂND 3: tab-uri jos (Oferte / Produse / Email Tracking) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Stânga: tab-uri Oferte/Produse */}
            <div
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  padding: "12px 16px 0",
                  borderBottom: `0.5px solid ${T.border}`,
                }}
              >
                {(
                  [
                    ["offers", `Oferte (${offers.length})`],
                    ["products", "Produse"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k as Tab)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom:
                        tab === k
                          ? `2px solid ${T.sage}`
                          : "2px solid transparent",
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: tab === k ? T.sage : T.muted,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <i
                      className={`ti ${k === "offers" ? "ti-file-text" : "ti-package"}`}
                      style={{ fontSize: 14 }}
                    />{" "}
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ padding: 16 }}>
                {tab === "offers" ? (
                  offers.length === 0 ? (
                    <Empty icon="ti-file-off" text="Nicio ofertă încă." />
                  ) : (
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          {[
                            "Ofertă",
                            "Data",
                            "Valoare",
                            "Produse",
                            "Status",
                            "",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                fontSize: 10,
                                fontWeight: 500,
                                color: T.muted,
                                textTransform: "uppercase",
                                letterSpacing: ".05em",
                                padding: "0 0 8px",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((o, idx) => (
                          <tr
                            key={o.id}
                            onClick={() => onOpenOffer?.(o.id)}
                            style={{
                              cursor: "pointer",
                              borderTop: `0.5px solid ${T.linen}`,
                            }}
                          >
                            <td
                              style={{
                                padding: "10px 8px 10px 0",
                                fontSize: 13,
                                fontWeight: 500,
                                color: T.espresso,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <i
                                className="ti ti-file-text"
                                style={{
                                  fontSize: 14,
                                  color: T.muted,
                                  marginRight: 5,
                                }}
                              />
                              Oferta #{offers.length - idx}
                            </td>
                            <td
                              style={{
                                padding: "10px 8px",
                                fontSize: 12,
                                color: T.warm,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtDate(o.sent_at)}
                            </td>
                            <td
                              style={{
                                padding: "10px 8px",
                                fontSize: 13,
                                fontWeight: 500,
                                color: T.green,
                              }}
                            >
                              €{o.total_eur.toFixed(0)}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 4,
                                }}
                              >
                                {o.products.slice(0, 2).map((p, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: 10,
                                      background: T.lavenderLight,
                                      color: T.lavender,
                                      borderRadius: 999,
                                      padding: "2px 8px",
                                    }}
                                  >
                                    {p}
                                  </span>
                                ))}
                                {o.products.length > 2 && (
                                  <span
                                    style={{ fontSize: 10, color: T.muted }}
                                  >
                                    +{o.products.length - 2}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  background: T.sageLight,
                                  color: T.sage,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                }}
                              >
                                Trimisă
                              </span>
                            </td>
                            <td
                              style={{ padding: "10px 0", textAlign: "right" }}
                            >
                              <i
                                className="ti ti-chevron-right"
                                style={{ fontSize: 15, color: T.muted }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : productCounts.length === 0 ? (
                  <Empty icon="ti-package-off" text="Niciun produs încă." />
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {productCounts.map(([name, count]) => (
                      <div
                        key={name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: `0.5px solid ${T.linen}`,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            color: T.espresso,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <i
                            className="ti ti-droplet"
                            style={{ fontSize: 15, color: T.sage }}
                          />
                          {name}
                        </span>
                        <span style={{ fontSize: 12, color: T.muted }}>
                          {count} {count === 1 ? "ofertă" : "oferte"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dreapta: Email Tracking */}
            <div
              style={{
                background: T.white,
                border: `0.5px solid ${T.border}`,
                borderRadius: 14,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.espresso,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="ti ti-mail" style={{ fontSize: 15 }} /> Email Tracking
              </div>

              {/* Stat: Deschideri */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <TrackingStat
                  icon="ti-eye"
                  iconBg={T.lavenderLight}
                  iconColor={T.lavender}
                  label="Emailuri deschise"
                  value={contact.email_opens ?? 0}
                  suffix="ori"
                  active={(contact.email_opens ?? 0) > 0}
                />
                <TrackingStat
                  icon="ti-cursor-text"
                  iconBg={T.sageLight}
                  iconColor={T.sage}
                  label="Link-uri apăsate"
                  value={contact.email_clicks ?? 0}
                  suffix="click-uri"
                  active={(contact.email_clicks ?? 0) > 0}
                />
                <TrackingStat
                  icon="ti-file-text"
                  iconBg={T.amberLight}
                  iconColor={T.amber}
                  label="Oferte trimise"
                  value={contact.offers_count ?? 0}
                  suffix="oferte"
                  active={(contact.offers_count ?? 0) > 0}
                />
              </div>

              {/* Status email */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Status email
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <StatusDot
                    active={!isEmailOptOut}
                    activeLabel="Emailuri active"
                    inactiveLabel="Email dezactivat"
                    activeColor={T.green}
                    inactiveBg={T.redLight}
                    inactiveColor={T.red}
                  />
                  <StatusDot
                    active={!isBlocked}
                    activeLabel="Comunicare permisă"
                    inactiveLabel="Comunicare blocată"
                    activeColor={T.green}
                    inactiveBg={T.redLight}
                    inactiveColor={T.red}
                  />
                </div>
              </div>

              {(contact.email_opens ?? 0) === 0 && (contact.email_clicks ?? 0) === 0 && (
                <div style={{ marginTop: 14, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
                  Datele de tracking apar automat după ce contactul deschide sau apasă un link în email.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Subcomponente ===
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: T.white,
        border: `0.5px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: T.espresso,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <i
        className={`ti ${icon}`}
        style={{ fontSize: 16, color: T.muted, marginTop: 1 }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
        <div
          style={{ fontSize: 13, color: T.espresso, wordBreak: "break-word" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
function Kpi({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  valueColor,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: T.white,
        border: `0.5px solid ${T.border}`,
        borderRadius: 12,
        padding: "16px 14px",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <i
          className={`ti ${icon}`}
          style={{ fontSize: 16, color: iconColor }}
        />
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: valueColor ?? T.espresso,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{label}</div>
    </div>
  );
}
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px", color: T.muted }}>
      <i
        className={`ti ${icon}`}
        style={{
          fontSize: 30,
          display: "block",
          marginBottom: 10,
          color: T.sageMid,
        }}
      />
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}
function hdrBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 15px",
    background: T.white,
    border: `0.5px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: T.warm,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "11px 16px",
    background: T.white,
    border: `0.5px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    color: T.warm,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
function TrackingStat({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  suffix,
  active,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  suffix: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: active ? iconBg : T.cream,
        borderRadius: 10,
        border: `0.5px solid ${active ? iconColor + "33" : T.border}`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: active ? iconBg : T.linen,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: active ? iconColor : T.muted }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: active ? T.espresso : T.muted, lineHeight: 1.2 }}>
          {value}
          <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, marginLeft: 4 }}>{suffix}</span>
        </div>
      </div>
    </div>
  );
}
function StatusDot({
  active,
  activeLabel,
  inactiveLabel,
  activeColor,
  inactiveBg,
  inactiveColor,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeColor: string;
  inactiveBg: string;
  inactiveColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 12,
        color: active ? activeColor : inactiveColor,
        background: active ? T.greenLight : inactiveBg,
        borderRadius: 8,
        padding: "5px 10px",
        fontWeight: 500,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? activeColor : inactiveColor,
          flexShrink: 0,
        }}
      />
      {active ? activeLabel : inactiveLabel}
    </div>
  );
}
function CommToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (val: boolean) => void;
  dangerOff?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? T.muted : T.espresso }}>{label}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        title={disabled ? undefined : checked ? "Dezactivează" : "Activează"}
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          border: "none",
          background: disabled ? T.border : checked ? T.sage : "rgba(201,79,106,0.25)",
          position: "relative",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 0.2s",
          flexShrink: 0,
          outline: "none",
          padding: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 4,
            left: checked ? 22 : 4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}
