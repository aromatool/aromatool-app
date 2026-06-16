import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getRecommendedAction, displayStatus, statusGroup } from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";
import type { Contact } from "../pages/DashboardPage";
import PhoneInput from "./PhoneInput";
import { useProfileCountry } from "../hooks/useProfileCountry";

interface OfferRow {
  id: string;
  sent_at: string;
  total_eur: number;
  products: string[];
  status?: string | null;
  // Ofertă logată manual pe alt canal (WhatsApp/telefon): fără produse, €0.
  external?: boolean;
  sentVia?: string | null;
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
  onMarkSent?: (c: Contact) => void;
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
  const then = new Date(d);
  const now = new Date();
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function initials(name?: string | null, email?: string): string {
  return (name || email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function fmtTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Eticheta canalului pentru ofertele logate manual (WhatsApp/telefon/alt canal).
function channelLabelFor(sv: string | null | undefined, t: TFunction): string {
  return sv === "phone"
    ? t("contacts.markSent.phone")
    : sv === "other"
      ? t("contacts.markSent.other")
      : t("contacts.markSent.whatsapp");
}

function statusPill(status: string, t: TFunction) {
  const label = displayStatus(status as ContactStatus, t);
  switch (statusGroup(status as ContactStatus)) {
    case "client":
      return { label, bg: T.greenLight, color: T.green };
    case "team":
      return { label, bg: T.lavenderLight, color: T.lavender };
    case "inactive":
      return { label, bg: T.linen, color: T.muted };
    case "prospect":
    default:
      return { label, bg: T.amberLight, color: T.amber };
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
const STATUS_OPTIONS: { value: ContactStatus }[] = [
  { value: "prospect" },
  { value: "client_nou" },
  { value: "team_member" },
  { value: "inactiv" },
];

type Tab = "offers" | "products" | "tracking";

export default function ContactModal({
  contact,
  onClose,
  onWhatsApp,
  onEmail,
  onOffer,
  onMarkSent,
  onStatusChange,
  onNotesChange,
  onOpenOffer,
  onContactUpdate,
  onContactDelete,
}: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const profileCountry = useProfileCountry();
  const locale = t("actions.localeCode");
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
  const [editDraft, setEditDraft] = useState({ name: "", phone: "", email: "", source: "", language: "ro" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingComm, setSavingComm] = useState<"email_opt_out" | "communication_blocked" | null>(null);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
        .select("id,sent_at,total_eur,products_json,sent_via")
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

    const offerRows: OfferRow[] = (offData ?? []).map((o: any) => {
      const products = (o.products_json ?? []).map((p: any) => p.name);
      return {
        id: o.id,
        sent_at: o.sent_at,
        total_eur: o.total_eur ?? 0,
        products,
        status: o.status,
        // Fără produse = ofertă marcată manual ca trimisă pe alt canal (€0).
        external: products.length === 0,
        sentVia: o.sent_via,
      };
    });
    setOffers(offerRows);

    const events: (TimelineItem & { sortKey: number })[] = [];
    offerRows.forEach((o, idx) => {
      events.push({
        date: fmtDate(o.sent_at, locale),
        time: fmtTime(o.sent_at, locale),
        sortKey: new Date(o.sent_at).getTime(),
        // Oferta externă (€0, fără produse) NU arată valoarea — doar canalul.
        label: o.external
          ? t("contacts.timeline.offerSentExternal", {
              channel: channelLabelFor(o.sentVia, t),
            })
          : t("contacts.timeline.offerSent"),
        sub: o.external
          ? t("contacts.slideOver.sentExternalShort")
          : t("contacts.timeline.offerSub", {
              n: offerRows.length - idx,
              value: o.total_eur.toFixed(0),
            }),
        type: "offer",
        amount: o.external ? undefined : `€${o.total_eur.toFixed(0)}`,
        // Fără ofertă reală de deschis pentru cele externe.
        offerId: o.external ? undefined : o.id,
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
          ? t("contacts.timeline.whatsappSent")
          : st === "sent"
            ? t("contacts.timeline.emailSent")
            : t("contacts.timeline.followupSent");
      const sub =
        st === "whatsapp_initiated"
          ? t("contacts.timeline.subWhatsapp")
          : st === "sent"
            ? t("contacts.timeline.emailSent")
            : t("contacts.timeline.subFollowup");
      events.push({
        date: fmtDate(f.sent_at, locale),
        time: fmtTime(f.sent_at, locale),
        sortKey: new Date(f.sent_at).getTime(),
        label,
        sub,
        type,
      });
    });
    events.push({
      date: fmtDate(c.created_at, locale),
      time: fmtTime(c.created_at, locale),
      sortKey: new Date(c.created_at).getTime(),
      label: t("contacts.timeline.contactCreated"),
      sub: t("contacts.timeline.addedManually"),
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

  const action = getRecommendedAction(contact, t);
  const inCRM = daysSince(contact.created_at);
  const lastContact = daysSince(
    contact.last_activity_at ?? contact.first_offer_at,
  );
  const pill = statusPill(contact.status, t);

  const handleStatusSelect = async (s: ContactStatus) => {
    if (statusGroup(s) === statusGroup(contact.status)) {
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
      language: contact.language_code ?? "ro",
    });
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const updates: Record<string, string | null> = {
      name: editDraft.name.trim() || null,
      phone: editDraft.phone.trim() || null,
      source: editDraft.source.trim() || null,
      language_code: editDraft.language || "ro",
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
          label: t("contacts.cta.createOffer"),
          icon: "ti-file-text",
          onClick: () => onOffer?.(contact),
          color: action.accentColor,
        }
      : action.type === "none" || action.type === "reactivate"
        ? {
            label: t("contacts.cta.sendMessage"),
            icon: "ti-brand-whatsapp",
            onClick: () => onWhatsApp?.(contact),
            color: T.green,
          }
        : {
            label: t("contacts.cta.sendEmail"),
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
        padding: isMobile ? 0 : "3vh 2vw",
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
          borderRadius: isMobile ? 0 : 18,
          width: isMobile ? "100vw" : "min(1240px, 95vw)",
          height: isMobile ? "100dvh" : "92vh",
          paddingTop: isMobile ? "env(safe-area-inset-top)" : 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isMobile ? "none" : "0 24px 80px rgba(61,53,48,0.25)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: isMobile ? "14px 16px" : "18px 24px",
            borderBottom: `0.5px solid ${T.border}`,
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 12 : 14,
            flexShrink: 0,
            flexWrap: isMobile ? "wrap" : "nowrap",
            position: "relative",
          }}
        >
          <div
            style={{
              width: isMobile ? 50 : 56,
              height: isMobile ? 50 : 56,
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
          <div
            style={{
              flex: isMobile ? "1 1 100%" : 1,
              minWidth: 0,
              marginRight: isMobile ? 44 : 0,
            }}
          >
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
                  {t("contacts.modal.inCrmPrefix", { count: inCRM })}
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
                {savingEdit ? t("contacts.common.saving") : t("contacts.common.save")}
              </button>
              <button onClick={() => setEditMode(false)} style={hdrBtn()}>
                <i className="ti ti-x" style={{ fontSize: 15 }} /> {t("contacts.common.cancel")}
              </button>
            </div>
          ) : (
            <button onClick={handleStartEdit} style={hdrBtn()}>
              <i className="ti ti-edit" style={{ fontSize: 15 }} /> {t("contacts.modal.editContact")}
            </button>
          )}
          {!editMode && (
          <>
          <div
            style={{ position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setStatusMenuOpen((v) => !v)}
              disabled={changingStatus}
              style={hdrBtn()}
            >
              <span>{t("contacts.modal.changeStatus")}</span>
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
                    statusGroup(o.value) === statusGroup(contact.status);
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
                      {displayStatus(o.value, t)}
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
              title={t("contacts.modal.more")}
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
                  {t("contacts.modal.deletePermanently")}
                </button>
              </div>
            )}
          </div>
          </>
          )}
          <button
            onClick={onClose}
            aria-label={t("contacts.common.close")}
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
              ...(isMobile
                ? { position: "absolute", top: 14, right: 16 }
                : {}),
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
            {t("contacts.modal.contactOptedOut")}
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
            {t("contacts.modal.emailOffBanner")}
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
                {t("contacts.modal.deleteTitle")}
              </div>
              <div style={{ fontSize: 13, color: T.warm, lineHeight: 1.6, marginBottom: 6 }}>
                {t("contacts.modal.deleteBodyPre")}<strong>{contact.name || contact.email}</strong>{t("contacts.modal.deleteBodyPost")}
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
                {t("contacts.modal.deleteIrreversible")}
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
                    ? <><i className="ti ti-loader-2" style={{ fontSize: 14 }} /> {t("contacts.modal.deleting")}</>
                    : <><i className="ti ti-trash" style={{ fontSize: 14 }} /> {t("contacts.modal.deletePermanently")}</>
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
                  {t("contacts.common.cancel")}
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
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: isMobile ? 14 : 20,
            paddingBottom: isMobile ? "calc(14px + env(safe-area-inset-bottom))" : 20,
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 14 : 16,
            background: T.cream,
          }}
        >
          {/* FORMULAR EDITARE */}
          {editMode && (
            <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: 24, maxWidth: 520 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.espresso, marginBottom: 20 }}>
                {t("contacts.modal.editContactInfo")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { key: "name", label: t("contacts.modal.fieldName"), icon: "ti-user", placeholder: t("contacts.modal.namePlaceholder") },
                  { key: "phone", label: t("contacts.modal.fieldPhone"), icon: "ti-phone", placeholder: t("contacts.modal.phonePlaceholder") },
                  { key: "email", label: t("contacts.modal.fieldEmail"), icon: "ti-mail", placeholder: t("contacts.modal.emailPlaceholder") },
                  { key: "source", label: t("contacts.modal.fieldSource"), icon: "ti-map-pin", placeholder: t("contacts.modal.sourcePlaceholder") },
                ].map(({ key, label, icon, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      <i className={`ti ${icon}`} style={{ fontSize: 13 }} /> {label}
                    </label>
                    {key === "phone" ? (
                      <PhoneInput
                        value={editDraft.phone}
                        defaultCountry={profileCountry}
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
                <div>
                  <label style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <i className="ti ti-language" style={{ fontSize: 13 }} /> {t("contacts.modal.fieldLanguage")}
                  </label>
                  <select
                    value={editDraft.language}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, language: e.target.value }))}
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
                      cursor: "pointer",
                    }}
                  >
                    <option value="ro">🇷🇴 {t("common.romanian")}</option>
                    <option value="en">🇬🇧 {t("common.english")}</option>
                  </select>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>
                    {t("contacts.modal.fieldLanguageHint")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  style={{ background: T.sage, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {savingEdit ? t("contacts.common.saving") : t("contacts.modal.saveChanges")}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  style={{ background: T.linen, color: T.warm, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  {t("contacts.common.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* RÂND 1: Acțiune recomandată + KPI-uri */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1.7fr",
              gap: isMobile ? 14 : 16,
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
                <i className="ti ti-send" style={{ fontSize: 13 }} />{" "}
                {t("contacts.common.recommendedAction")}
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
                  {t("contacts.modal.commBlockedActions")}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={primaryCTA.onClick}
                    disabled={isEmailOptOut && primaryCTA.icon === "ti-mail"}
                    title={isEmailOptOut && primaryCTA.icon === "ti-mail" ? t("contacts.modal.emailOffTooltip") : undefined}
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
                      {t("contacts.cta.whatsapp")}
                    </button>
                  )}
                  <button onClick={() => onOffer?.(contact)} style={ghostBtn()}>
                    <i className="ti ti-file-text" style={{ fontSize: 15 }} />{" "}
                    {t("contacts.cta.newOffer")}
                  </button>
                  {action.type === "needs_offer" && onMarkSent && (
                    <button
                      onClick={() => onMarkSent(contact)}
                      title={t("contacts.markSent.rowTooltip")}
                      style={ghostBtn()}
                    >
                      <i className="ti ti-check" style={{ fontSize: 15 }} />{" "}
                      {t("contacts.markSent.button")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* KPI-uri */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(4, 1fr)",
                gap: 10,
              }}
            >
              <Kpi
                icon="ti-file-text"
                iconBg={T.sageLight}
                iconColor={T.sage}
                value={String(contact.offers_count ?? 0)}
                label={t("contacts.modal.statOffers")}
              />
              <Kpi
                icon="ti-currency-euro"
                iconBg={T.amberLight}
                iconColor={T.amber}
                value={`€${(contact.total_eur ?? 0).toFixed(0)}`}
                label={t("contacts.modal.statValue")}
                valueColor={T.green}
              />
              <Kpi
                icon="ti-clock"
                iconBg={T.lavenderLight}
                iconColor={T.lavender}
                value={lastContact !== null ? t("contacts.common.dur", { count: lastContact }) : "—"}
                label={t("contacts.modal.statLastContact")}
              />
              <Kpi
                icon="ti-refresh"
                iconBg={T.roseLight}
                iconColor={T.rose}
                value={String(contact.followup_count ?? 0)}
                label={t("contacts.modal.statFollowups")}
              />
            </div>
          </div>

          {/* RÂND 2: 2 coloane — stânga info+notițe, dreapta istoric */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "340px 1fr",
              gap: isMobile ? 14 : 16,
              alignItems: "start",
            }}
          >
            {/* STÂNGA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title={t("contacts.modal.contactInfo")}>
                <InfoRow
                  icon="ti-phone"
                  label={t("contacts.modal.fieldPhone")}
                  value={contact.phone || "—"}
                />
                <InfoRow
                  icon="ti-mail"
                  label={t("contacts.modal.fieldEmail")}
                  value={contact.email || "—"}
                />
                {contact.source && (
                  <InfoRow
                    icon="ti-map-pin"
                    label={t("contacts.modal.fieldSource")}
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
                    <div style={{ fontSize: 11, color: T.muted }}>{t("contacts.modal.fieldStatus")}</div>
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
                  label={t("contacts.modal.fieldCreatedAt")}
                  value={fmtDate(contact.created_at, locale)}
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
                    {t("contacts.common.notes")}
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
                      {t("contacts.common.edit")}
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
                      placeholder={t("contacts.common.notesPlaceholder")}
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
                        {savingNotes ? t("contacts.common.saving") : t("contacts.common.save")}
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
                        {t("contacts.common.cancel")}
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
                    {contact.notes || t("contacts.common.notesEmpty")}
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
                  {t("contacts.modal.commPrefs")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Email opt-out toggle */}
                  <CommToggle
                    label={t("contacts.modal.commEmails")}
                    description={isEmailOptOut ? t("contacts.modal.commDisabled") : t("contacts.modal.commActive")}
                    checked={!isEmailOptOut}
                    disabled={isBlocked || savingComm === "email_opt_out"}
                    onChange={(val) => handleToggleEmailOptOut(!val)}
                    t={t}
                    dangerOff
                  />
                  {/* Communication blocked toggle */}
                  <CommToggle
                    label={t("contacts.modal.commFull")}
                    description={isBlocked ? t("contacts.modal.commBlockedState") : t("contacts.modal.commAllowed")}
                    checked={!isBlocked}
                    disabled={savingComm === "communication_blocked"}
                    onChange={(val) => handleToggleCommunicationBlocked(!val)}
                    t={t}
                    dangerOff
                  />
                  {isBlocked && (
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                      {t("contacts.modal.commBlockedHint")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DREAPTA: Istoric activități */}
            <Card title={t("contacts.common.activityHistory")}>
              {loading ? (
                <Empty icon="ti-loader" text={t("contacts.modal.loadingHistory")} />
              ) : timeline.length === 0 ? (
                <Empty icon="ti-history" text={t("contacts.modal.noEvents")} />
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
                      {showAllTimeline ? t("contacts.modal.showLess") : t("contacts.modal.showMore")}{" "}
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
              gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr",
              gap: isMobile ? 14 : 16,
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
                    ["offers", t("contacts.modal.tabOffers", { count: offers.length })],
                    ["products", t("contacts.modal.tabProducts")],
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
                    <Empty icon="ti-file-off" text={t("contacts.modal.noOffers")} />
                  ) : (
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr>
                          {[
                            t("contacts.modal.colOffer"),
                            t("contacts.modal.colDate"),
                            t("contacts.modal.colValue"),
                            t("contacts.modal.colProducts"),
                            t("contacts.modal.colStatus"),
                            "",
                          ].map((h, hi) => (
                            <th
                              key={hi}
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
                            onClick={() => !o.external && onOpenOffer?.(o.id)}
                            style={{
                              cursor: o.external ? "default" : "pointer",
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
                              {t("contacts.modal.offerNumber", { n: offers.length - idx })}
                            </td>
                            <td
                              style={{
                                padding: "10px 8px",
                                fontSize: 12,
                                color: T.warm,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtDate(o.sent_at, locale)}
                            </td>
                            <td
                              style={{
                                padding: "10px 8px",
                                fontSize: 13,
                                fontWeight: 500,
                                color: o.external ? T.muted : T.green,
                              }}
                            >
                              {o.external
                                ? channelLabelFor(o.sentVia, t)
                                : `€${o.total_eur.toFixed(0)}`}
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
                                {t("contacts.modal.offerSent")}
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
                  <Empty icon="ti-package-off" text={t("contacts.modal.noProducts")} />
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
                          {t("contacts.modal.offerCount", { count })}
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
                <i className="ti ti-mail" style={{ fontSize: 15 }} /> {t("contacts.modal.emailTrackingTitle")}
              </div>

              {/* Statistici angajament (click real first-party + oferte) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <TrackingStat
                  icon="ti-cursor-text"
                  iconBg={T.sageLight}
                  iconColor={T.sage}
                  label={t("contacts.modal.trackClicks")}
                  value={contact.email_clicks ?? 0}
                  suffix={t("contacts.modal.trackClicksSuffix")}
                  active={(contact.email_clicks ?? 0) > 0}
                />
                <TrackingStat
                  icon="ti-file-text"
                  iconBg={T.amberLight}
                  iconColor={T.amber}
                  label={t("contacts.modal.trackOffers")}
                  value={contact.offers_count ?? 0}
                  suffix={t("contacts.modal.trackOffersSuffix")}
                  active={(contact.offers_count ?? 0) > 0}
                />
              </div>

              {/* Status email */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {t("contacts.modal.statusEmail")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <StatusDot
                    active={!isEmailOptOut}
                    activeLabel={t("contacts.modal.emailsActive")}
                    inactiveLabel={t("contacts.modal.emailDisabledDot")}
                    activeColor={T.green}
                    inactiveBg={T.redLight}
                    inactiveColor={T.red}
                  />
                  <StatusDot
                    active={!isBlocked}
                    activeLabel={t("contacts.modal.commAllowedDot")}
                    inactiveLabel={t("contacts.modal.commBlockedDot")}
                    activeColor={T.green}
                    inactiveBg={T.redLight}
                    inactiveColor={T.red}
                  />
                </div>
              </div>

              {(contact.email_clicks ?? 0) === 0 && (
                <div style={{ marginTop: 14, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
                  {t("contacts.modal.trackingHint")}
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
  t,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (val: boolean) => void;
  t: TFunction;
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
        title={disabled ? undefined : checked ? t("contacts.modal.commToggleOff") : t("contacts.modal.commToggleOn")}
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
