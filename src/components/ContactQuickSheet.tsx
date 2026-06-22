import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import ModalPortal from "./ModalPortal";
import { getRecommendedAction, displayStatus } from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";
import type { Contact } from "../pages/DashboardPage";

interface Props {
  contact: Contact | null;
  onClose: () => void;
  onWhatsApp?: (contact: Contact) => void;
  onEmail?: (contact: Contact) => void;
  onOffer?: (contact: Contact) => void;
  onMarkSent?: (contact: Contact) => void;
  onStatusChange?: (
    contactId: string,
    newStatus: ContactStatus,
  ) => Promise<void> | void;
  onNotesChange?: (contactId: string, notes: string) => Promise<void> | void;
  onOpenOffer?: (offerId: string) => void;
  onViewFullProfile?: (contact: Contact) => void;
}

const T = {
  sage: "#5C7A5C",
  sageDk: "#4A6A4A",
  sageLt: "#E8F0E8",
  sageMid: "#C8D8C8",
  cream: "#FAFAF7",
  linen: "#F5EEE8",
  esp: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  roseLt: "#FDF0EE",
  rose: "#D4A5A0",
  lav: "#9888B8",
  lavLt: "#F0EEF8",
  lavBd: "#DDD8F0",
  amb: "#C4906A",
  ambLt: "#FDF5EE",
  ambBd: "#E8C8A8",
  bd: "#EDE8E0",
  wh: "#FFFFFF",
  grn: "#2E8A58",
  grnLt: "#E8F8F0",
  grnBd: "#B8E8CE",
  red: "#C94F6A",
  redLt: "#FFF0F4",
  redBd: "#F4C0CC",
};

function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  const then = new Date(iso);
  const now = new Date();
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function initials(name?: string | null): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ── Inline SVG icons (render in preview sandbox where the Tabler webfont is blocked) ── */
const PATHS: Record<string, string> = {
  "arrow-left": "M19 12H5 M12 19l-7-7 7-7",
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  whatsapp:
    "M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 1 1 21 11.5z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
  check: "M20 6L9 17l-5-5",
  calendar: "M4 5h16v16H4z M4 9h16 M8 3v4 M16 3v4",
  clock: "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z M12 7v5l3 2",
  package: "M3 7l9-4 9 4-9 4-9-4z M3 7v10l9 4 9-4V7 M12 11v10",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  "user-plus":
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6",
  external:
    "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
  flame:
    "M12 2c2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3 0-5-1-7z",
  instagram:
    "M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M17 6.8h.01",
  tag: "M20 12l-8 8-9-9V4h7z M7.5 7.5h.01",
  ban: "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z M5 5l14 14",
  "mail-off": "M4 6h16v12H4z M4 7l8 6 8-6 M3 3l18 18",
};

function Icon({
  name,
  size = 18,
  color = "currentColor",
  fill = "none",
  strokeWidth = 2,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
}) {
  const d = PATHS[name] ?? PATHS.tag;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}


const STATUS_OPTIONS: { value: ContactStatus; bg: string; color: string }[] = [
  { value: "prospect", bg: T.ambLt, color: T.amb },
  { value: "client_nou", bg: T.sageLt, color: T.sage },
  { value: "team_member", bg: T.lavLt, color: T.lav },
  { value: "inactiv", bg: T.linen, color: T.muted },
];

const canonicalStatus = (s: ContactStatus): ContactStatus => {
  if (s === "in_followup") return "prospect";
  if (s === "client_fidel") return "client_nou";
  return s;
};

function SectionLabel({
  children,
  action,
}: {
  children: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: T.muted,
          textTransform: "uppercase",
          letterSpacing: ".06em",
        }}
      >
        {children}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            fontSize: 13,
            color: T.sage,
            fontWeight: 500,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function StatTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  euro,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  euro?: boolean;
}) {
  return (
    <div
      style={{
        background: T.cream,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
          color: iconColor,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {euro ? "€" : <Icon name={icon} size={15} color={iconColor} />}
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, color: T.esp, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function ContactQuickSheet({
  contact,
  onClose,
  onWhatsApp,
  onEmail,
  onOffer,
  onMarkSent,
  onStatusChange,
  onNotesChange,
  onOpenOffer,
  onViewFullProfile,
}: Props) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Entrance animation (slide up) — only while the sheet is actually open.
  // Scroll-ul de fundal (body + .main-content) e blocat de ModalPortal, deci
  // nu mai atingem `document.body.style.overflow` aici.
  useEffect(() => {
    if (!contact) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(id);
    };
  }, [contact?.id]);

  useEffect(() => {
    setEditingNotes(false);
    setNotesDraft(contact?.notes ?? "");
  }, [contact?.id, contact?.notes]);

  if (!contact) return null;

  const action = getRecommendedAction(contact, t);
  const inCRM = daysSince(contact.created_at);
  const lastContact = contact.last_activity_at
    ? daysSince(contact.last_activity_at)
    : null;
  const blocked = !!contact.communication_blocked;
  const emailOff = !!contact.email_opt_out;
  const currentCanonical = canonicalStatus(contact.status);

  const sourceIcon = (() => {
    const s = (contact.source ?? "").toLowerCase();
    if (s.includes("insta")) return "instagram";
    return "tag";
  })();

  const handleStatusSelect = async (newStatus: ContactStatus) => {
    if (newStatus === contact.status || currentCanonical === newStatus) {
      return;
    }
    setChangingStatus(true);
    try {
      await onStatusChange?.(contact.id, newStatus);
    } finally {
      setChangingStatus(false);
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

  // ── Primary + secondary action mapping (actions-first) ──
  const primary =
    action.type === "needs_offer"
      ? {
          label: t("contacts.cta.sendOffer"),
          icon: "file",
          onClick: () => onOffer?.(contact),
          disabled: blocked,
          color: action.accentColor,
        }
      : action.type === "none"
        ? {
            label: t("contacts.cta.writeMessage"),
            icon: "whatsapp",
            onClick: () => onWhatsApp?.(contact),
            disabled: blocked,
            color: T.grn,
          }
        : {
            label: emailOff
              ? t("contacts.cta.emailDisabled")
              : t("contacts.cta.sendEmail"),
            icon: "mail",
            onClick: () => onEmail?.(contact),
            disabled: blocked || emailOff,
            color: action.accentColor,
          };

  return (
    <ModalPortal>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(61,53,48,.4)",
          zIndex: 10050,
          opacity: shown ? 1 : 0,
          transition: "opacity .25s ease",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          background: T.wh,
          zIndex: 10051,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          paddingTop: "env(safe-area-inset-top)",
          transform: shown ? "translateY(0)" : "translateY(100%)",
          transition: "transform .32s cubic-bezier(.22,.61,.36,1)",
          overflow: "hidden",
          overscrollBehavior: "contain",
        }}
      >
        {/* Grabber */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 8,
            paddingBottom: 2,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              background: T.sageMid,
            }}
          />
        </div>

        {/* Header bar: back */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 14px 10px",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            aria-label={t("contacts.common.close")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: T.cream,
              border: `0.5px solid ${T.bd}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.esp,
            }}
          >
            <Icon name="arrow-left" size={19} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: "4px 18px 18px",
          }}
        >
          {/* Identity */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                flexShrink: 0,
                background: contact.avatarBg ?? T.sageLt,
                color: contact.avatarColor ?? T.sage,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {initials(contact.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: T.esp,
                  lineHeight: 1.15,
                }}
              >
                {contact.name}
              </div>
              <div style={{ fontSize: 13, color: T.warm, marginTop: 3 }}>
                {t("contacts.slideOver.subtitle", {
                  status: displayStatus(contact.status, t),
                  count: inCRM,
                })}
              </div>
              {contact.source && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: T.warm,
                    marginTop: 6,
                  }}
                >
                  <Icon name={sourceIcon} size={15} color={T.lav} />
                  {t("contacts.slideOver.sourcePrefix")}
                  {contact.source}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              height: 1,
              background: T.bd,
              margin: "16px -18px",
            }}
          />

          {/* Recommended action */}
          <div
            style={{
              background: action.accentBg,
              border: `0.5px solid ${action.accentColor}40`,
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: action.accentColor,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="flame" size={14} color={action.accentColor} />
                {t("contacts.common.recommendedAction")}
              </span>
              {(action.priority === "urgent" ||
                action.priority === "attention") && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color:
                      action.priority === "urgent" ? T.red : T.amb,
                    background: T.wh,
                    border: `0.5px solid ${
                      action.priority === "urgent" ? T.redBd : T.ambBd
                    }`,
                    borderRadius: 12,
                    padding: "2px 10px",
                  }}
                >
                  {action.priority === "urgent"
                    ? t("contacts.common.urgent")
                    : t("contacts.common.attention")}
                </span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: T.esp }}>
              {action.title}
            </div>
            <div style={{ fontSize: 13, color: T.warm, marginTop: 3 }}>
              {action.reason}
            </div>

            {blocked && (
              <div
                style={{
                  background: T.redLt,
                  border: `1px solid ${T.redBd}`,
                  borderRadius: 10,
                  padding: "9px 11px",
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: T.red,
                }}
              >
                <Icon name="ban" size={15} color={T.red} />
                <span>
                  <strong>{t("contacts.comm.blocked")}</strong>{" "}
                  {t("contacts.comm.blockedSub")}
                </span>
              </div>
            )}
            {!blocked && emailOff && (
              <div
                style={{
                  background: T.ambLt,
                  border: `1px solid ${T.ambBd}`,
                  borderRadius: 10,
                  padding: "9px 11px",
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: T.amb,
                }}
              >
                <Icon name="mail-off" size={15} color={T.amb} />
                <span>
                  <strong>{t("contacts.comm.emailOff")}</strong>{" "}
                  {t("contacts.comm.emailOffSub")}
                </span>
              </div>
            )}

            {/* Primary CTA */}
            <button
              onClick={primary.disabled ? undefined : primary.onClick}
              disabled={primary.disabled}
              style={{
                width: "100%",
                marginTop: 12,
                background: primary.disabled ? T.muted : primary.color,
                color: "#fff",
                border: "none",
                borderRadius: 11,
                padding: "13px",
                fontSize: 15,
                fontWeight: 600,
                cursor: primary.disabled ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "inherit",
                opacity: primary.disabled ? 0.6 : 1,
              }}
            >
              <Icon name={primary.icon} size={18} color="#fff" />
              {primary.label}
            </button>

            {/* Two secondary actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <SecondaryAction
                icon="whatsapp"
                label={t("contacts.cta.whatsapp")}
                onClick={() => onWhatsApp?.(contact)}
                disabled={blocked}
              />
              {action.type === "needs_offer" ? (
                <SecondaryAction
                  icon="mail"
                  label={t("contacts.cta.email")}
                  onClick={() => onEmail?.(contact)}
                  disabled={blocked || emailOff}
                />
              ) : (
                <SecondaryAction
                  icon="file"
                  label={t("contacts.cta.newOffer")}
                  onClick={() => onOffer?.(contact)}
                  disabled={blocked}
                />
              )}
            </div>

            {action.type === "needs_offer" && onMarkSent && !blocked && (
              <button
                onClick={() => onMarkSent(contact)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  background: T.wh,
                  color: T.sage,
                  border: `0.5px solid ${T.sageMid}`,
                  borderRadius: 10,
                  padding: "10px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  fontFamily: "inherit",
                }}
              >
                <Icon name="check" size={16} color={T.sage} />
                {t("contacts.markSent.button")}
              </button>
            )}
          </div>

          {/* Status — visible inline selector */}
          <div style={{ marginTop: 20 }}>
            <SectionLabel>{t("contacts.common.status")}</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {STATUS_OPTIONS.map((opt) => {
                const selected = opt.value === currentCanonical;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusSelect(opt.value)}
                    disabled={changingStatus}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "12px 12px",
                      borderRadius: 11,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: changingStatus ? "wait" : "pointer",
                      background: selected ? opt.bg : T.wh,
                      color: selected ? opt.color : T.warm,
                      border: selected
                        ? `1.5px solid ${opt.color}`
                        : `0.5px solid ${T.bd}`,
                      opacity: changingStatus && !selected ? 0.5 : 1,
                      transition: "background .15s, border-color .15s",
                    }}
                  >
                    {selected && (
                      <Icon name="check" size={14} color={opt.color} />
                    )}
                    {displayStatus(opt.value, t)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Relationship summary */}
          <div style={{ marginTop: 20 }}>
            <SectionLabel>{t("contacts.slideOver.relationSummary")}</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <StatTile
                icon="calendar"
                iconBg={T.sageLt}
                iconColor={T.sage}
                value={t("contacts.common.dur", { count: inCRM })}
                label={t("contacts.slideOver.statInCrm")}
              />
              <StatTile
                icon="file"
                iconBg={T.ambLt}
                iconColor={T.amb}
                value={String(contact.offers_count ?? 0)}
                label={t("contacts.slideOver.statOffers")}
              />
              <StatTile
                icon="euro"
                euro
                iconBg={T.grnLt}
                iconColor={T.grn}
                value={`€${(contact.total_eur ?? 0).toFixed(0)}`}
                label={t("contacts.slideOver.statValue")}
              />
              <StatTile
                icon="clock"
                iconBg={T.lavLt}
                iconColor={T.lav}
                value={
                  lastContact !== null
                    ? t("contacts.common.dur", { count: lastContact })
                    : "—"
                }
                label={t("contacts.slideOver.statLastContact")}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginTop: 20 }}>
            <SectionLabel
              action={
                !editingNotes
                  ? {
                      label: contact.notes
                        ? t("contacts.common.edit")
                        : t("contacts.slideOver.addNote"),
                      onClick: () => {
                        setNotesDraft(contact.notes ?? "");
                        setEditingNotes(true);
                      },
                    }
                  : undefined
              }
            >
              {t("contacts.common.notes")}
            </SectionLabel>
            {editingNotes ? (
              <div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  autoFocus
                  rows={4}
                  placeholder={t("contacts.common.notesPlaceholder")}
                  style={{
                    width: "100%",
                    // 16px min prevents iOS Safari from auto-zooming on focus
                    // (which otherwise leaves the whole page zoomed + scrollable).
                    fontSize: 16,
                    color: T.esp,
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                    border: `0.5px solid ${T.sageMid}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    style={{
                      background: T.sage,
                      color: "#fff",
                      border: "none",
                      borderRadius: 9,
                      padding: "9px 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: savingNotes ? "wait" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {savingNotes
                      ? t("contacts.common.saving")
                      : t("contacts.common.save")}
                  </button>
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesDraft(contact.notes ?? "");
                    }}
                    disabled={savingNotes}
                    style={{
                      background: T.linen,
                      color: T.warm,
                      border: `0.5px solid ${T.bd}`,
                      borderRadius: 9,
                      padding: "9px 18px",
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
                  background: contact.notes ? T.ambLt : T.cream,
                  border: `0.5px solid ${contact.notes ? T.ambBd : T.bd}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  color: contact.notes ? T.esp : T.muted,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {contact.notes || t("contacts.common.notesEmpty")}
              </div>
            )}
          </div>

          {/* Last offer */}
          {contact.last_offer &&
            (() => {
              const lo = contact.last_offer!;
              const isExternal = lo.external === true;
              const channelLabel =
                lo.sentVia === "phone"
                  ? t("contacts.markSent.phone")
                  : lo.sentVia === "other"
                    ? t("contacts.markSent.other")
                    : t("contacts.markSent.whatsapp");
              const dateStr = new Date(lo.sentAt).toLocaleDateString(
                t("actions.localeCode"),
                { day: "numeric", month: "short", year: "numeric" },
              );
              const innerCard = (
                <>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: T.wh,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={isExternal ? "send" : "package"}
                      size={20}
                      color={T.lav}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, color: T.esp }}
                    >
                      {t("contacts.slideOver.offerDate", { date: dateStr })}
                    </div>
                    <div
                      style={{ fontSize: 12, color: T.muted, marginTop: 1 }}
                    >
                      {isExternal
                        ? t("contacts.slideOver.sentExternal", {
                            channel: channelLabel,
                          })
                        : t("contacts.slideOver.products", {
                            count: lo.productCount,
                          })}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.lav,
                      background: T.wh,
                      border: `0.5px solid ${T.lavBd}`,
                      borderRadius: 10,
                      padding: "4px 10px",
                      flexShrink: 0,
                    }}
                  >
                    {isExternal
                      ? t("contacts.slideOver.sentExternalShort")
                      : `€${lo.totalEur.toFixed(0)}`}
                  </span>
                </>
              );
              const cardStyle: CSSProperties = {
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: T.lavLt,
                border: `0.5px solid ${T.lavBd}`,
                borderRadius: 14,
                padding: "12px 14px",
                fontFamily: "inherit",
                textAlign: "left",
              };
              return (
                <div style={{ marginTop: 20 }}>
                  <SectionLabel
                    action={
                      isExternal
                        ? undefined
                        : {
                            label: t("contacts.slideOver.viewOffer"),
                            onClick: () => onOpenOffer?.(lo.id),
                          }
                    }
                  >
                    {t("contacts.slideOver.lastOffer")}
                  </SectionLabel>
                  {isExternal ? (
                    <div style={cardStyle}>{innerCard}</div>
                  ) : (
                    <button
                      onClick={() => onOpenOffer?.(lo.id)}
                      style={{ ...cardStyle, cursor: "pointer" }}
                    >
                      {innerCard}
                    </button>
                  )}
                </div>
              );
            })()}

          {/* Recent activity */}
          {contact.timeline && contact.timeline.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <SectionLabel>
                {t("contacts.common.activityHistory")}
              </SectionLabel>
              {contact.timeline.slice(0, 6).map((item: any, idx: number) => {
                const clickable = item.type === "offer" && item.offerId;
                const iconCfgMap: Record<
                  string,
                  { icon: string; bg: string; color: string }
                > = {
                  offer: { icon: "file", bg: T.roseLt, color: T.rose },
                  email: { icon: "mail", bg: T.lavLt, color: T.lav },
                  followup: { icon: "send", bg: T.lavLt, color: T.lav },
                  whatsapp: { icon: "whatsapp", bg: T.grnLt, color: T.grn },
                  event: { icon: "user-plus", bg: T.linen, color: T.muted },
                };
                const cfg = iconCfgMap[item.type] ?? iconCfgMap.event;
                return (
                  <div
                    key={idx}
                    onClick={() => clickable && onOpenOffer?.(item.offerId)}
                    style={{
                      display: "flex",
                      gap: 11,
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop: idx === 0 ? "none" : `0.5px solid ${T.linen}`,
                      cursor: clickable ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        flexShrink: 0,
                        background: cfg.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={cfg.icon} size={15} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: clickable ? T.sage : T.esp,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {item.label}
                        {item.amount && (
                          <span style={{ color: T.grn, fontWeight: 600 }}>
                            · {item.amount}
                          </span>
                        )}
                        {clickable && (
                          <Icon name="external" size={12} color={T.sage} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 1 }}>
                        {t("contacts.slideOver.byYou")}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>
                      {item.date}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 18px calc(14px + env(safe-area-inset-bottom))",
            borderTop: `0.5px solid ${T.bd}`,
            background: T.wh,
          }}
        >
          <button
            onClick={() => onViewFullProfile?.(contact)}
            style={{
              width: "100%",
              background: T.wh,
              color: T.sage,
              border: `1px solid ${T.sage}`,
              borderRadius: 12,
              padding: "13px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("contacts.slideOver.viewFullProfile")}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

function SecondaryAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background: T.wh,
        color: disabled ? T.muted : T.esp,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 11,
        padding: "11px",
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        fontFamily: "inherit",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon name={icon} size={17} color={disabled ? T.muted : T.esp} />
      {label}
    </button>
  );
}
