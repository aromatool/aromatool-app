import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRecommendedAction, displayStatus } from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";
import type { Contact } from "../pages/DashboardPage";

interface Props {
  contact: Contact | null;
  onClose: () => void;
  onWhatsApp?: (contact: Contact) => void;
  onEmail?: (contact: Contact) => void;
  onOffer?: (contact: Contact) => void;
  onStatusChange?: (
    contactId: string,
    newStatus: ContactStatus,
  ) => Promise<void> | void;
  onNotesChange?: (contactId: string, notes: string) => Promise<void> | void;
  onOpenOffer?: (offerId: string) => void;
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
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PrimaryButton({
  color,
  icon,
  label,
  onClick,
  disabled,
}: {
  color: string;
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
        background: disabled ? T.muted : color,
        color: "#fff",
        border: "none",
        borderRadius: 9,
        padding: "11px 12px",
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: "inherit",
        width: "100%",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
      {label}
    </button>
  );
}

function SecondaryButton({
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
        background: "transparent",
        color: disabled ? T.muted : T.warm,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 8,
        padding: "7px 12px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
        flex: 1,
        justifyContent: "center",
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
      {label}
    </button>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <div
      style={{
        background: T.cream,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <i
          className={`ti ${icon}`}
          style={{ fontSize: 13, color: iconColor }}
          aria-hidden="true"
        />
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: T.esp }}>{value}</div>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
    </div>
  );
}

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
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
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
            fontSize: 12,
            color: T.sage,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const STATUS_OPTIONS: {
  value: ContactStatus;
  bg: string;
  color: string;
}[] = [
  { value: "prospect", bg: T.ambLt, color: T.amb },
  { value: "client_nou", bg: T.sageLt, color: T.sage },
  { value: "team_member", bg: T.lavLt, color: T.lav },
  { value: "inactiv", bg: T.linen, color: T.muted },
];

export default function ContactSlideOver({
  contact,
  onClose,
  onWhatsApp,
  onEmail,
  onOffer,
  onStatusChange,
  onNotesChange,
  onOpenOffer,
}: Props) {
  const { t } = useTranslation();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    setEditingNotes(false);
    setStatusMenuOpen(false);
    setNotesDraft(contact?.notes ?? "");
  }, [contact?.id, contact?.notes]);

  if (!contact) return null;

  const action = getRecommendedAction(contact, t);
  const ac = {
    bg: action.accentBg,
    border: action.accentColor + "55",
    tc: action.accentColor,
    main: action.title,
    sub: action.reason,
  };

  const inCRM = daysSince(contact.created_at);
  const lastContact = contact.last_activity_at
    ? daysSince(contact.last_activity_at)
    : null;

  const emailOpens = contact.email_opens ?? 0;
  const emailClicks = contact.email_clicks ?? 0;
  const hasEmailTracking = emailOpens > 0 || emailClicks > 0;

  const handleStatusSelect = async (newStatus: ContactStatus) => {
    // Dacă alegerea corespunde aceluiași status canonic, nu schimbăm nimic
    // (ex: contact e client_fidel, userul apasă "Client" → rămâne client_fidel)
    if (
      newStatus === contact.status ||
      canonicalStatus(contact.status) === newStatus
    ) {
      setStatusMenuOpen(false);
      return;
    }
    setChangingStatus(true);
    try {
      await onStatusChange?.(contact.id, newStatus);
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

  // Mapează statusul intern la opțiunea canonică afișată în dropdown
  // (client_fidel→client_nou ca "Client", in_followup→prospect ca "Prospect")
  const canonicalStatus = (s: ContactStatus): ContactStatus => {
    if (s === "in_followup") return "prospect";
    if (s === "client_fidel") return "client_nou";
    return s;
  };
  const currentCanonical = canonicalStatus(contact.status);
  const currentStatusLabel = displayStatus(currentCanonical, t);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(61,53,48,.3)",
          zIndex: 9998,
          backdropFilter: "blur(1px)",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          maxWidth: "100vw",
          background: "#fff",
          borderLeft: `0.5px solid ${T.bd}`,
          zIndex: 9999,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxShadow: "-4px 0 24px rgba(61,53,48,.08)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `0.5px solid ${T.bd}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              flexShrink: 0,
              background: contact.avatarBg ?? T.sageLt,
              color: contact.avatarColor ?? T.sage,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {initials(contact.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: T.esp }}>
              {contact.name}
            </div>
            <div style={{ fontSize: 12, color: T.warm, marginTop: 2 }}>
              {t("contacts.slideOver.subtitle", {
                status: displayStatus(contact.status, t),
                days: inCRM,
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("contacts.common.close")}
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: T.linen,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: T.warm,
              flexShrink: 0,
            }}
          >
            <i
              className="ti ti-x"
              style={{ fontSize: 14 }}
              aria-hidden="true"
            />
          </button>
        </div>

        <div style={{ padding: "16px 20px", flex: 1 }}>
          {(contact.email || contact.phone || contact.source) && (
            <div
              style={{
                marginBottom: 14,
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {contact.email && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: T.warm,
                  }}
                >
                  <i
                    className="ti ti-mail"
                    style={{ fontSize: 14, color: T.muted }}
                    aria-hidden="true"
                  />
                  {contact.email}
                </div>
              )}
              {contact.phone && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: T.warm,
                  }}
                >
                  <i
                    className="ti ti-phone"
                    style={{ fontSize: 14, color: T.muted }}
                    aria-hidden="true"
                  />
                  {contact.phone}
                </div>
              )}
              {contact.source && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: T.warm,
                  }}
                >
                  <i
                    className="ti ti-tag"
                    style={{ fontSize: 14, color: T.muted }}
                    aria-hidden="true"
                  />
                  {t("contacts.slideOver.sourcePrefix")}
                  {contact.source}
                </div>
              )}
            </div>
          )}

          {/* Acțiune recomandată */}
          <div
            style={{
              background: ac.bg,
              border: `0.5px solid ${ac.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
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
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: ac.tc,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <i
                  className="ti ti-target"
                  style={{ fontSize: 12 }}
                  aria-hidden="true"
                />
                {t("contacts.common.recommendedAction")}
              </div>
              {action.priority === "urgent" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.red,
                    background: T.wh,
                    border: `0.5px solid ${T.redBd}`,
                    borderRadius: 10,
                    padding: "2px 8px",
                  }}
                >
                  {t("contacts.common.urgent")}
                </span>
              )}
              {action.priority === "attention" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: T.amb,
                    background: T.wh,
                    border: `0.5px solid ${T.ambBd}`,
                    borderRadius: 10,
                    padding: "2px 8px",
                  }}
                >
                  {t("contacts.common.attention")}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.esp }}>
              {ac.main}
            </div>
            <div style={{ fontSize: 12, color: T.warm, marginTop: 3 }}>
              {ac.sub}
            </div>

            {/* ── COMMUNICATION CONTROLS WARNINGS ── */}
            {contact.communication_blocked && (
              <div style={{
                background: T.redLt, border: `1px solid ${T.redBd}`, borderRadius: 8,
                padding: "8px 10px", marginTop: 10,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: T.red,
              }}>
                <i className="ti ti-ban" style={{ fontSize: 14 }} />
                <span><strong>{t("contacts.comm.blocked")}</strong> {t("contacts.comm.blockedSub")}</span>
              </div>
            )}
            {!contact.communication_blocked && contact.email_opt_out && (
              <div style={{
                background: T.ambLt, border: `1px solid ${T.ambBd}`, borderRadius: 8,
                padding: "8px 10px", marginTop: 10,
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: T.amb,
              }}>
                <i className="ti ti-mail-off" style={{ fontSize: 14 }} />
                <span><strong>{t("contacts.comm.emailOff")}</strong> {t("contacts.comm.emailOffSub")}</span>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              {action.type === "needs_offer" ? (
                <PrimaryButton
                  color={action.accentColor}
                  icon="ti-file-text"
                  label={t("contacts.cta.sendOffer")}
                  onClick={() => onOffer?.(contact)}
                  disabled={!!contact.communication_blocked}
                />
              ) : action.type === "none" ? (
                <PrimaryButton
                  color={T.grn}
                  icon="ti-brand-whatsapp"
                  label={t("contacts.cta.writeMessage")}
                  onClick={() => onWhatsApp?.(contact)}
                  disabled={!!contact.communication_blocked}
                />
              ) : (
                <PrimaryButton
                  color={action.accentColor}
                  icon="ti-mail"
                  label={contact.email_opt_out ? t("contacts.cta.emailDisabled") : t("contacts.cta.sendEmail")}
                  onClick={() => onEmail?.(contact)}
                  disabled={!!contact.communication_blocked || !!contact.email_opt_out}
                />
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {action.type !== "needs_offer" && (
                <SecondaryButton
                  icon="ti-file-text"
                  label={t("contacts.cta.offer")}
                  onClick={() => onOffer?.(contact)}
                  disabled={!!contact.communication_blocked}
                />
              )}
              {action.type === "needs_offer" && (
                <SecondaryButton
                  icon="ti-mail"
                  label={t("contacts.cta.email")}
                  onClick={() => onEmail?.(contact)}
                  disabled={!!contact.communication_blocked || !!contact.email_opt_out}
                />
              )}
              <SecondaryButton
                icon="ti-brand-whatsapp"
                label={t("contacts.cta.whatsapp")}
                onClick={() => onWhatsApp?.(contact)}
                disabled={!!contact.communication_blocked}
              />
            </div>
          </div>

          {/* Rezumat relație — 4 carduri */}
          <SectionLabel>{t("contacts.slideOver.relationSummary")}</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <StatCard
              icon="ti-calendar"
              iconBg={T.sageLt}
              iconColor={T.sage}
              value={t("contacts.common.days", { count: inCRM })}
              label={t("contacts.slideOver.statInCrm")}
            />
            <StatCard
              icon="ti-file-text"
              iconBg={T.ambLt}
              iconColor={T.amb}
              value={String(contact.offers_count ?? 0)}
              label={t("contacts.slideOver.statOffers")}
            />
            <StatCard
              icon="ti-currency-euro"
              iconBg={T.grnLt}
              iconColor={T.grn}
              value={`€${(contact.total_eur ?? 0).toFixed(0)}`}
              label={t("contacts.slideOver.statValue")}
            />
            <StatCard
              icon="ti-clock"
              iconBg={T.lavLt}
              iconColor={T.lav}
              value={lastContact !== null ? t("contacts.common.days", { count: lastContact }) : "—"}
              label={t("contacts.slideOver.statLastContact")}
            />
          </div>

          {/* Notițe — mutate sus */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel
              action={
                !editingNotes
                  ? {
                      label: contact.notes ? t("contacts.common.edit") : t("contacts.slideOver.addNote"),
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
                    fontSize: 12,
                    color: T.esp,
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                    border: `0.5px solid ${T.sageMid}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    style={{
                      background: T.sage,
                      color: "#fff",
                      border: "none",
                      borderRadius: 7,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: savingNotes ? "wait" : "pointer",
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
                    disabled={savingNotes}
                    style={{
                      background: T.linen,
                      color: T.warm,
                      border: `0.5px solid ${T.bd}`,
                      borderRadius: 7,
                      padding: "6px 14px",
                      fontSize: 12,
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
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: contact.notes ? T.esp : T.muted,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {contact.notes || t("contacts.common.notesEmpty")}
              </div>
            )}
          </div>

          {/* Status — mutat sus, editabil */}
          <div style={{ marginBottom: 16, position: "relative" }}>
            <SectionLabel>{t("contacts.common.status")}</SectionLabel>
            <button
              onClick={() => setStatusMenuOpen((v) => !v)}
              disabled={changingStatus}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: contact.statusBg ?? T.linen,
                color: contact.statusColor ?? T.warm,
                border: `0.5px solid ${T.bd}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 500,
                cursor: changingStatus ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              <span>
                {changingStatus ? t("contacts.common.saving") : currentStatusLabel}
              </span>
              <i
                className={`ti ti-chevron-${statusMenuOpen ? "up" : "down"}`}
                style={{ fontSize: 15 }}
                aria-hidden="true"
              />
            </button>
            {statusMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: "#fff",
                  border: `0.5px solid ${T.bd}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(61,53,48,.12)",
                  zIndex: 5,
                  overflow: "hidden",
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusSelect(opt.value)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background:
                        opt.value === currentCanonical ? T.cream : "#fff",
                      border: "none",
                      borderBottom: `0.5px solid ${T.linen}`,
                      padding: "9px 12px",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontWeight: 500,
                        background: opt.bg,
                        color: opt.color,
                      }}
                    >
                      {displayStatus(opt.value, t)}
                    </span>
                    {opt.value === currentCanonical && (
                      <i
                        className="ti ti-check"
                        style={{
                          fontSize: 14,
                          color: T.sage,
                          marginLeft: "auto",
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Istoric activități — cu iconițe per tip + link la oferte */}
          {contact.timeline && contact.timeline.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>{t("contacts.common.activityHistory")}</SectionLabel>
              {contact.timeline.slice(0, 6).map((item: any, idx: number) => {
                const clickable = item.type === "offer" && item.offerId;
                const iconCfgMap: Record<string, { icon: string; bg: string; color: string }> = {
                  offer: { icon: "ti-file-text", bg: T.roseLt, color: T.rose },
                  email: { icon: "ti-mail", bg: T.lavLt, color: T.lav },
                  followup: { icon: "ti-send", bg: T.lavLt, color: T.lav },
                  whatsapp: {
                    icon: "ti-brand-whatsapp",
                    bg: T.grnLt,
                    color: T.grn,
                  },
                  event: { icon: "ti-user-plus", bg: T.linen, color: T.muted },
                };
                const iconCfg = iconCfgMap[item.type as string] ?? iconCfgMap["event"];
                return (
                  <div
                    key={idx}
                    onClick={() => clickable && onOpenOffer?.(item.offerId!)}
                    style={{
                      display: "flex",
                      gap: 9,
                      marginBottom: 8,
                      alignItems: "center",
                      cursor: clickable ? "pointer" : "default",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        flexShrink: 0,
                        background: iconCfg.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className={`ti ${iconCfg.icon}`}
                        style={{ fontSize: 13, color: iconCfg.color }}
                        aria-hidden="true"
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.muted,
                        width: 60,
                        flexShrink: 0,
                      }}
                    >
                      {item.date}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: clickable ? T.sage : T.esp,
                        flex: 1,
                        fontWeight: clickable ? 500 : 400,
                      }}
                    >
                      {item.label}
                      {clickable && (
                        <i
                          className="ti ti-external-link"
                          style={{ fontSize: 11, marginLeft: 4 }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    {item.amount && (
                      <div
                        style={{ fontSize: 12, color: T.grn, fontWeight: 500 }}
                      >
                        {item.amount}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ultima ofertă */}
          {contact.last_offer && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>{t("contacts.slideOver.lastOffer")}</SectionLabel>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: T.cream,
                  border: `0.5px solid ${T.bd}`,
                  borderRadius: 10,
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: T.sageLt,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="ti ti-package"
                    style={{ fontSize: 20, color: T.sage }}
                    aria-hidden="true"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.esp }}>
                    {t("contacts.slideOver.offerDate", {
                      date: new Date(
                        contact.last_offer.sentAt,
                      ).toLocaleDateString(t("actions.localeCode"), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }),
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {t("contacts.slideOver.products", {
                      count: contact.last_offer.productCount,
                    })}{" "}
                    · €{contact.last_offer.totalEur.toFixed(0)}
                  </div>
                </div>
                <button
                  onClick={() => onOpenOffer?.(contact.last_offer!.id)}
                  style={{
                    background: T.wh,
                    color: T.sage,
                    border: `0.5px solid ${T.sageMid}`,
                    borderRadius: 7,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {t("contacts.slideOver.viewOffer")}{" "}
                  <i
                    className="ti ti-external-link"
                    style={{ fontSize: 12 }}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          )}

          {/* Produse recomandate ultima dată */}
          {contact.offer_products && contact.offer_products.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>{t("contacts.slideOver.recommendedProducts")}</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {contact.offer_products.map((p: any, i: any) => (
                  <span
                    key={i}
                    style={{
                      background: T.lavLt,
                      color: T.lav,
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 11,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Email tracking */}
          <div style={{ marginBottom: 8 }}>
            <SectionLabel>{t("contacts.slideOver.emailTracking")}</SectionLabel>
            {hasEmailTracking ? (
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    background: T.lavLt,
                    border: `0.5px solid ${T.lavBd}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <i
                    className="ti ti-mail-opened"
                    style={{ fontSize: 16, color: T.lav }}
                    aria-hidden="true"
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.lav }}>
                      {emailOpens}
                    </div>
                    <div style={{ fontSize: 11, color: T.warm }}>
                      {t("contacts.slideOver.opens", { count: emailOpens })}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: T.lavLt,
                    border: `0.5px solid ${T.lavBd}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <i
                    className="ti ti-click"
                    style={{ fontSize: 16, color: T.lav }}
                    aria-hidden="true"
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.lav }}>
                      {emailClicks}
                    </div>
                    <div style={{ fontSize: 11, color: T.warm }}>
                      {t("contacts.slideOver.clicks", { count: emailClicks })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: T.lavLt,
                  border: `0.5px solid ${T.lavBd}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    background: T.wh,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="ti ti-mail"
                    style={{ fontSize: 16, color: T.lav }}
                    aria-hidden="true"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.lav }}>
                    {t("contacts.slideOver.trackingUnavailable")}
                  </div>
                  <div style={{ fontSize: 11, color: T.warm, marginTop: 1 }}>
                    {t("contacts.slideOver.trackingUnavailableSub")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
