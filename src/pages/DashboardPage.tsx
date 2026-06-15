import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCartStore } from "../hooks/useCartStore";
import ContactSlideOver from "../components/ContactSlideOver";
import ContactQuickSheet from "../components/ContactQuickSheet";
import FollowupModal from "../components/FollowupModal";
import { openWhatsApp, startOffer } from "../lib/contactActions";
import { useSendEmail } from "../hooks/useSendEmail";
import {
  getRecommendedAction,
  getActionType,
  displayStatus,
  shortReason,
  getNextAction,
  groupLabel,
} from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";
import { aggregateContacts, selectFocusToday } from "../lib/focusToday";
import { INACTIVE_DAYS } from "../lib/crmThresholds";
import { useSubscription } from "../lib/subscription";
import LockedOverlay from "../components/LockedOverlay";

// Tipurile trăiesc acum într-un modul curat (contactTypes.ts), refolosit și
// de Edge Functions. Le re-exportăm de aici pentru compatibilitate cu
// importurile existente (`import type { Contact } from "./DashboardPage"`).
export type {
  Contact,
  LastOfferInfo,
  ContactTimeline,
} from "../lib/contactTypes";
import type { Contact, LastOfferInfo } from "../lib/contactTypes";

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

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function greeting(t: TFunction): string {
  const h = new Date().getHours();
  if (h < 12) return t("dashboard.greetingMorning");
  if (h < 18) return t("dashboard.greetingAfternoon");
  return t("dashboard.greetingEvening");
}

function enrichContact(c: Contact, t: TFunction): Contact {
  const statusMap: Record<
    ContactStatus,
    { label: string; bg: string; color: string }
  > = {
    prospect: { label: t("dashboard.status.prospect"), bg: T.ambLt, color: T.amb },
    in_followup: { label: t("dashboard.status.in_followup"), bg: T.lavLt, color: T.lav },
    inactiv: { label: t("dashboard.status.inactiv"), bg: T.redLt, color: T.red },
    client_nou: { label: t("dashboard.status.client_nou"), bg: T.sageLt, color: T.sage },
    client_fidel: { label: t("dashboard.status.client_fidel"), bg: T.sageLt, color: T.sage },
    team_member: { label: t("dashboard.status.team_member"), bg: T.lavLt, color: T.lav },
  };
  const avMap: Record<ContactStatus, { bg: string; color: string }> = {
    prospect: { bg: T.ambLt, color: T.amb },
    in_followup: { bg: T.lavLt, color: T.lav },
    inactiv: { bg: T.redLt, color: T.red },
    client_nou: { bg: T.grnLt, color: T.grn },
    client_fidel: { bg: T.sageLt, color: T.sage },
    team_member: { bg: T.lavLt, color: T.lav },
  };
  const sm = statusMap[c.status];
  const av = avMap[c.status];

  const daysSinceOffer = daysSince(c.first_offer_at);
  const daysSinceActivity = daysSince(c.last_activity_at ?? c.first_offer_at);
  const inCRM = daysSince(c.created_at);

  let urgentLabel: string | undefined;
  let urgencyDays: number | undefined;
  let urgencyLabel: string | undefined;
  let urgencyColor: string | undefined;
  let barColor: string = T.muted;
  let actionText: string | undefined;

  if (c.status === "inactiv" || daysSinceActivity >= INACTIVE_DAYS) {
    urgentLabel = t("dashboard.urgentLabel");
    urgencyDays = daysSinceActivity;
    urgencyLabel = t("dashboard.urgency.daysInactive");
    urgencyColor = T.red;
    barColor = T.red;
    actionText = t("dashboard.action.reactivate");
  } else if (c.status === "prospect" && (c.offers_count ?? 0) === 0) {
    urgencyDays = inCRM;
    urgencyLabel = t("dashboard.urgency.daysInCrm");
    urgencyColor = T.amb;
    barColor = T.amb;
    actionText = t("dashboard.action.sendOffer");
  } else if (c.status === "in_followup") {
    urgencyDays = daysSinceOffer;
    urgencyLabel = t("dashboard.urgency.daysSinceOffer");
    urgencyColor = T.lav;
    barColor = T.lav;
    actionText = t("dashboard.action.followup");
  } else if (c.status === "client_nou" || c.status === "client_fidel") {
    urgencyDays = daysSinceActivity;
    urgencyLabel = t("dashboard.urgency.daysSinceLastActivity");
    urgencyColor = T.grn;
    barColor = T.grn;
    actionText = t("dashboard.action.contact");
  }

  return {
    ...c,
    avatarBg: av.bg,
    avatarColor: av.color,
    statusLabel: sm.label,
    statusBg: sm.bg,
    statusColor: sm.color,
    urgentLabel,
    urgencyDays,
    urgencyLabel,
    urgencyColor,
    barColor,
    actionText,
  };
}

function initials(name?: string | null): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ contact, size = 36 }: { contact: Contact; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: contact.avatarBg,
        color: contact.avatarColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.33,
        fontWeight: 500,
      }}
    >
      {initials(contact.name)}
    </div>
  );
}

function SectionTitle({
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
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
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
          {action.label} →
        </button>
      )}
    </div>
  );
}

function Card({
  style,
  children,
}: {
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: T.wh,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 10,
        padding: "12px 14px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ContactCard({
  contact,
  onClick,
  onMarkSent,
  mobile = false,
}: {
  contact: Contact;
  onClick: () => void;
  onMarkSent?: (c: Contact) => void;
  mobile?: boolean;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const action = getRecommendedAction(contact, t);
  const reason = shortReason(contact, t);
  const isUrgent = action.priority === "urgent";
  const isAttention = action.priority === "attention";
  const highlighted = isUrgent || isAttention;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isUrgent ? action.accentBg : T.wh,
        border: `0.5px solid ${hovered ? T.sageMid : highlighted ? action.accentColor + "40" : T.bd}`,
        borderRadius: mobile ? 14 : 10,
        padding: mobile ? "13px 13px" : "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        display: "flex",
        alignItems: mobile ? "flex-start" : "center",
        gap: mobile ? 11 : 11,
        transition: "border-color .15s",
      }}
    >
      <div
        style={{
          width: isUrgent ? 4 : 3,
          alignSelf: "stretch",
          borderRadius: 2,
          flexShrink: 0,
          background: action.accentColor,
        }}
      />
      <Avatar contact={contact} size={mobile ? 40 : 36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: mobile ? 14.5 : 13,
              fontWeight: mobile ? 600 : 500,
              color: T.esp,
              minWidth: 0,
              ...(mobile && {
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }),
            }}
          >
            {contact.name}
          </span>
          {highlighted && mobile && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: action.accentColor,
                background: T.wh,
                border: `0.5px solid ${action.accentColor}40`,
                borderRadius: 10,
                padding: "2px 8px",
                flexShrink: 0,
              }}
            >
              {isUrgent
                ? t("dashboard.badge.urgent")
                : t("dashboard.badge.attention")}
            </span>
          )}
        </div>
        {mobile && (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {displayStatus(contact.status, t)}
          </div>
        )}
        <div
          style={
            mobile
              ? { fontSize: 13, marginTop: 5, lineHeight: 1.35 }
              : {
                  fontSize: 12,
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }
          }
        >
          <span
            style={{
              color: highlighted ? action.accentColor : T.warm,
              fontWeight: highlighted ? 500 : 400,
            }}
          >
            {action.title}
          </span>
          {mobile ? (
            <span style={{ color: T.muted }}> · {reason}</span>
          ) : (
            <>
              <span style={{ color: T.muted }}>·</span>
              <span style={{ color: T.muted }}>{reason}</span>
            </>
          )}
        </div>
      </div>
      {!mobile && (
        <span
          style={{
            fontSize: 11,
            color: T.muted,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          · {displayStatus(contact.status, t)}
        </span>
      )}
      {action.type === "needs_offer" &&
        onMarkSent &&
        !contact.communication_blocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkSent(contact);
            }}
            title={t("contacts.markSent.rowTooltip")}
            style={{
              alignSelf: "center",
              flexShrink: 0,
              width: 30,
              height: 30,
              borderRadius: 8,
              background: T.wh,
              border: `0.5px solid ${T.sageMid}`,
              color: T.sage,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="ti ti-check" style={{ fontSize: 15 }} aria-hidden="true" />
          </button>
        )}
      {highlighted && !mobile && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: action.accentColor,
            background: T.wh,
            border: `0.5px solid ${action.accentColor}40`,
            borderRadius: 10,
            padding: "2px 8px",
            flexShrink: 0,
          }}
        >
          {isUrgent ? t("dashboard.badge.urgent") : t("dashboard.badge.attention")}
        </span>
      )}
      {!mobile && (
        <i
          className="ti ti-chevron-right"
          style={{ fontSize: 15, color: T.muted }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  delta,
}: {
  label: string;
  value: string | number;
  delta?: string;
}) {
  return (
    <div style={{ background: T.linen, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 500, color: T.esp }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, color: T.grn, marginTop: 2 }}>{delta}</div>
      )}
    </div>
  );
}

// ── Iconițe inline (SVG) pentru layout-ul mobil (fără dependență de webfont) ──
type MIconProps = { size?: number; color?: string };
function MIcon({
  size = 18,
  color = "currentColor",
  children,
}: MIconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const IconTarget = (p: MIconProps) => (
  <MIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </MIcon>
);
const IconCal = (p: MIconProps) => (
  <MIcon {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="4" y1="11" x2="20" y2="11" />
  </MIcon>
);
const IconChart = (p: MIconProps) => (
  <MIcon {...p}>
    <line x1="3" y1="20" x2="21" y2="20" />
    <path d="M6 20v-7" />
    <path d="M12 20V5" />
    <path d="M18 20v-10" />
  </MIcon>
);
const IconClock = (p: MIconProps) => (
  <MIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </MIcon>
);
const IconUsers = (p: MIconProps) => (
  <MIcon {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20v-1a5 5 0 0 1 5 -5h1a5 5 0 0 1 5 5v1" />
    <path d="M16 5.3a3 3 0 0 1 0 5.4" />
    <path d="M20.5 20v-1a4.5 4.5 0 0 0 -3 -4.2" />
  </MIcon>
);
const IconUser = (p: MIconProps) => (
  <MIcon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6 -6h4a6 6 0 0 1 6 6v1" />
  </MIcon>
);
const IconBag = (p: MIconProps) => (
  <MIcon {...p}>
    <path d="M6.5 8h11l-1 12h-9z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </MIcon>
);
const IconEuro = (p: MIconProps) => (
  <MIcon {...p}>
    <path d="M17.5 7.5a6 6 0 1 0 0 9" />
    <line x1="3.5" y1="11" x2="13" y2="11" />
    <line x1="3.5" y1="14" x2="11" y2="14" />
  </MIcon>
);
const IconPlus = (p: MIconProps) => (
  <MIcon {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </MIcon>
);
const IconMail = (p: MIconProps) => (
  <MIcon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6l9 -6" />
  </MIcon>
);
const IconFile = (p: MIconProps) => (
  <MIcon {...p}>
    <path d="M14 3H7a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V8z" />
    <path d="M14 3v5h5" />
  </MIcon>
);
const IconSend = (p: MIconProps) => (
  <MIcon {...p}>
    <path d="M10 14l11 -11" />
    <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1z" />
  </MIcon>
);
const IconWhats = (p: MIconProps) => (
  <MIcon {...p}>
    <path d="M3 20l1.3 -3.9a8 8 0 1 1 3.6 3.6z" />
    <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
  </MIcon>
);

// Inel de progres (SVG) — Focus Today „X% finalizat".
function ProgressRing({
  percent,
  label,
  size = 66,
  stroke = 6,
}: {
  percent: number;
  label: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const offset = circ * (1 - pct / 100);
  return (
    <div
      style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={T.sageLt}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={T.grn}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .45s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{ fontSize: 15, fontWeight: 600, color: T.esp, lineHeight: 1 }}
        >
          {pct}%
        </span>
        <span style={{ fontSize: 8.5, color: T.muted, marginTop: 2 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// Card mobil (alb, rotunjit) + antet de secțiune cu iconiță.
function MCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: T.wh,
        border: `0.5px solid ${T.bd}`,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function MHeader({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: T.sageLt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: T.warm,
            textTransform: "uppercase",
            letterSpacing: ".05em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            fontSize: 12.5,
            color: T.sage,
            fontWeight: 500,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

// Card de statistică (mobil) — iconiță colorată + valoare + etichetă + sublabel.
function MStat({
  icon,
  bg,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  bg: string;
  value: string | number;
  label: string;
  sub: string;
}) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "13px 13px" }}>
      <div style={{ marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: T.esp, lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: T.esp,
          marginTop: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

// Selector de perioadă (mobil) — auto-conținut, refolosește logica desktop.
function PeriodSelectorMobile({
  period,
  setPeriod,
  t,
}: {
  period: "today" | "week" | "month";
  setPeriod: (p: "today" | "week" | "month") => void;
  t: TFunction;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 12,
          color: T.warm,
          background: T.linen,
          borderRadius: 20,
          padding: "5px 11px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <IconCal size={13} color={T.warm} />
        {period === "today"
          ? t("dashboard.period.todayFull")
          : period === "week"
            ? t("dashboard.period.weekFull")
            : t("dashboard.period.monthFull")}
      </div>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 4 }}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              background: "#fff",
              border: `0.5px solid ${T.bd}`,
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(61,53,48,.12)",
              zIndex: 5,
              overflow: "hidden",
              minWidth: 160,
            }}
          >
            {(
              [
                ["today", t("dashboard.period.todayFull")],
                ["week", t("dashboard.period.weekFull")],
                ["month", t("dashboard.period.monthFull")],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => {
                  setPeriod(val);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: val === period ? T.cream : "#fff",
                  border: "none",
                  borderBottom: `0.5px solid ${T.linen}`,
                  padding: "11px 12px",
                  fontSize: 13.5,
                  color: T.esp,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                {label}
                {val === period && (
                  <i
                    className="ti ti-check"
                    style={{ fontSize: 14, color: T.sage }}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { markOfferSent } = useSendEmail();
  const { hasAccess, openPaywall } = useSubscription();
  const setPrefillContactId = useCartStore((s) => s.setPrefillContactId);

  const [profile, setProfile] = useState<{
    full_name: string;
    follow_up_days?: number;
  } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [offers, setOffers] = useState<
    {
      id: string;
      contact_id: string;
      total_eur: number;
      sent_at: string;
      currency: string;
      products_json?: { name: string }[];
      sent_via?: string;
    }[]
  >([]);
  const [followupLog, setFollowupLog] = useState<
    { id: string; contact_id: string; sent_at: string; status?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [followupContact, setFollowupContact] = useState<Contact | null>(null);
  // „Marchează oferta ca trimisă" — picker canal + feedback
  const [markSentContact, setMarkSentContact] = useState<Contact | null>(null);
  const [markSentSaving, setMarkSentSaving] = useState(false);
  const [markSentToast, setMarkSentToast] = useState<string | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  // Layout mobil (single-column, carduri) sub 860px — desktop rămâne 2-coloane.
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 860px)").matches
      : false,
  );
  // Focus Today: extinde lista („+N alte acțiuni").
  const [focusExpanded, setFocusExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const [{ data: prof }, { data: ctcts }, { data: offs }, { data: fuLog }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, follow_up_days")
            .eq("id", user!.id)
            .single(),
          supabase
            .from("contacts")
            .select("*")
            .eq("user_id", user!.id)
            .order("updated_at", { ascending: false }),
          supabase
            .from("offers")
            .select("id,contact_id,total_eur,sent_at,currency,products_json,sent_via")
            .eq("user_id", user!.id)
            .order("sent_at", { ascending: false }),
          supabase
            .from("followup_log")
            .select("id,contact_id,sent_at,status")
            .eq("user_id", user!.id)
            .order("sent_at", { ascending: false }),
        ]);
      setProfile(prof);

      const offersList = offs ?? [];
      const fuLogList = fuLog ?? [];

      if (ctcts) {
        // Agregarea (oferte / follow-up / ultima activitate) e acum în modulul
        // partajat focusToday.ts — aceeași sursă folosită de Daily Focus Email.
        const aggregated = aggregateContacts(
          ctcts as Contact[],
          offersList,
          fuLogList,
        );
        // enrichContact adaugă doar câmpurile vizuale (culori, etichete).
        setContacts(aggregated.map((c) => enrichContact(c, t)));
      }
      setOffers(offersList);
      setFollowupLog(fuLogList);
      setLoading(false);
    }
    load();
  }, [user]);

  // Statistici filtrate pe perioada selectată
  const periodDays = period === "today" ? 1 : period === "week" ? 7 : 30;
  const periodLabel =
    period === "today"
      ? t("dashboard.period.today")
      : period === "week"
        ? t("dashboard.period.week")
        : t("dashboard.period.month");
  const newContactsInPeriod = contacts.filter(
    (c) => daysSince(c.created_at) < periodDays,
  ).length;
  const offersInPeriod = offers.filter(
    (o) => daysSince(o.sent_at) < periodDays,
  );
  const offersCountPeriod = offersInPeriod.length;
  const valuePeriod = offersInPeriod.reduce(
    (s, o) => s + (o.total_eur ?? 0),
    0,
  );

  const firstName = profile?.full_name?.split(" ")[0] ?? t("dashboard.defaultName");

  // Statistici
  const totalContacts = contacts.length;
  const activeClients = contacts.filter(
    (c) => c.status === "client_nou" || c.status === "client_fidel",
  ).length;

  // Focus today — sursă unică (focusToday.ts), refolosită de Daily Focus Email
  const focusToday = selectFocusToday(contacts, t).map((x) => x.contact);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isToday = (iso?: string | null) =>
    !!iso && new Date(iso).getTime() >= startOfToday.getTime();
  // Contacte cu activitate (ofertă / follow-up / WhatsApp) înregistrată AZI.
  const actedTodayIds = new Set<string>([
    ...offers.filter((o) => isToday(o.sent_at)).map((o) => o.contact_id),
    ...followupLog.filter((f) => isToday(f.sent_at)).map((f) => f.contact_id),
  ]);
  // ── Inel de progres Focus Today („X% finalizat") ──
  // Live, nu snapshot: „rezolvate" = contacte la care ai acționat azi ȘI care nu
  // mai apar în lista de focus. „Total" = rezolvate + rămase. Astfel inelul nu
  // poate ajunge la 100% cât timp mai ai acțiuni în listă (ex. o ofertă trimisă
  // azi care a generat un follow-up îl ține pe contact în „rămase").
  const focusRemainingIds = new Set(focusToday.map((c) => c.id));
  const focusDone = [...actedTodayIds].filter(
    (id) => !focusRemainingIds.has(id),
  ).length;
  const focusTotal = focusDone + focusRemainingIds.size;
  const focusPercent =
    focusTotal > 0 ? Math.round((focusDone / focusTotal) * 100) : 0;

  // Activitate recentă = oferte + follow-up-uri combinate, sortate descrescător
  type ActivityItem = {
    id: string;
    contactId: string;
    contact?: Contact;
    kind: "offer" | "followup" | "email" | "whatsapp";
    label: string;
    amount?: string;
    at: string;
  };
  const recentActivity: ActivityItem[] = [
    ...offers.map((o) => {
      // Ofertă logată manual pe alt canal (WhatsApp/telefon): €0, fără produse.
      // NU afișăm „· €0" — arătăm canalul, fără sumă.
      const isExternal = (o.products_json ?? []).length === 0;
      const ch =
        o.sent_via === "phone"
          ? t("contacts.markSent.phone")
          : o.sent_via === "other"
            ? t("contacts.markSent.other")
            : t("contacts.markSent.whatsapp");
      return {
        id: `offer-${o.id}`,
        contactId: o.contact_id,
        kind: "offer" as const,
        label: isExternal
          ? t("dashboard.activity.offerSentExternal", { channel: ch })
          : t("dashboard.activity.offerSent"),
        amount: isExternal ? undefined : `€${(o.total_eur ?? 0).toFixed(0)}`,
        at: o.sent_at,
      };
    }),
    ...followupLog.map((f) => {
      const isWa = f.status === "whatsapp_initiated";
      const isEmail = f.status === "sent";
      return {
        id: `fu-${f.id}`,
        contactId: f.contact_id,
        kind: isWa
          ? ("whatsapp" as const)
          : isEmail
            ? ("email" as const)
            : ("followup" as const),
        label: isWa
          ? t("dashboard.activity.whatsappSent")
          : isEmail
            ? t("dashboard.activity.emailSent")
            : t("dashboard.activity.followupSent"),
        at: f.sent_at,
      };
    }),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)
    .map((item) => ({
      ...item,
      contact: contacts.find((c) => c.id === item.contactId),
    }));

  // Agenda săptămânii — acțiuni viitoare (de mâine încolo), grupate temporal
  // Excludem contactele deja afișate în Focus Today (separare curată, fără dublură)
  const focusIds = new Set(focusToday.map((c) => c.id));
  const followUpDays = profile?.follow_up_days ?? 5;
  const agendaActions = contacts
    .filter((c) => !focusIds.has(c.id))
    .filter((c) => !c.communication_blocked)
    .map((c) => getNextAction(c, t, followUpDays))
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  // Grupare pe etichete temporale, păstrând ordinea
  const agendaGroups: { label: string; actions: typeof agendaActions }[] = [];
  for (const action of agendaActions) {
    const label = groupLabel(action.date, action.daysUntil, t);
    const lastGroup = agendaGroups[agendaGroups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.actions.push(action);
    } else {
      agendaGroups.push({ label, actions: [action] });
    }
  }

  // Handlere acțiuni contact
  const handleWhatsApp = (c: Contact) => {
    logWhatsApp(c);
    // Deschidem WhatsApp după ce React a comis update-ul de state.
    // Altfel window.open mută focusul pe noul tab înainte ca panoul să se re-randeze,
    // și utilizatorul nu vede schimbarea când revine.
    setTimeout(() => openWhatsApp(c, profile?.full_name), 50);
  };
  const handleEmail = (c: Contact) => {
    setSelectedContact(null);
    setFollowupContact(c);
  };
  const handleOffer = (c: Contact) => {
    startOffer(c, setPrefillContactId, navigate);
  };

  // Marchează oferta ca trimisă (din Dashboard): loghează o ofertă minimală
  // pe canalul ales → contactul iese din „Trimite prima ofertă" și din Focus.
  const handleMarkSent = async (channel: "whatsapp" | "phone" | "other") => {
    const c = markSentContact;
    if (!c) return;
    setMarkSentSaving(true);
    const ok = await markOfferSent(c.id, channel);
    setMarkSentSaving(false);
    if (!ok) {
      setMarkSentContact(null);
      return;
    }
    const now = new Date().toISOString();
    const patch = (x: Contact): Contact =>
      enrichContact(
        {
          ...x,
          offers_count: (x.offers_count ?? 0) + 1,
          last_activity_at: now,
          first_offer_at: x.first_offer_at ?? now,
        },
        t,
      );
    setContacts((prev) => prev.map((x) => (x.id === c.id ? patch(x) : x)));
    setSelectedContact((prev) =>
      prev && prev.id === c.id ? patch(prev) : prev,
    );
    setOffers((prev) => [
      {
        id: `local-offer-${Date.now()}`,
        contact_id: c.id,
        total_eur: 0,
        sent_at: now,
        currency: "RON",
        products_json: [],
        sent_via: channel,
      },
      ...prev,
    ]);
    setMarkSentToast(
      t("contacts.markSent.done", {
        channel: t(`contacts.markSent.${channel}`),
      }),
    );
    setMarkSentContact(null);
    setTimeout(() => setMarkSentToast(null), 4000);
  };

  // Schimbare status — update în DB + state local
  const handleStatusChange = async (
    contactId: string,
    newStatus: ContactStatus,
  ) => {
    const { error } = await supabase
      .from("contacts")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", contactId);
    if (error) {
      console.error("Eroare schimbare status:", error);
      return;
    }
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? enrichContact({
              ...c,
              status: newStatus,
              updated_at: new Date().toISOString(),
            }, t)
          : c,
      ),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contactId
        ? enrichContact({ ...prev, status: newStatus }, t)
        : prev,
    );
  };

  // Salvare notițe — update în DB + state local
  const handleNotesChange = async (contactId: string, notes: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({ notes })
      .eq("id", contactId);
    if (error) {
      console.error("Eroare salvare notițe:", error);
      return;
    }
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, notes } : c)),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contactId ? { ...prev, notes } : prev,
    );
  };

  // Log WhatsApp — contează ca follow-up (ai contactat persoana, doar pe alt canal)
  // Log WhatsApp — contează ca follow-up (ai contactat persoana, doar pe alt canal)
  const logWhatsApp = async (c: Contact) => {
    const now = new Date().toISOString();
    const todayLabel = new Date(now).toLocaleDateString(t("actions.localeCode"), {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    const newCount = (c.followup_count ?? 0) + 1;
    const newStatus: ContactStatus =
      c.status === "prospect" ? "in_followup" : c.status;

    // Actualizare optimistă a state-ului local (followup_count/last_followup_at sunt
    // câmpuri derivate — se recalculează din followup_log la următoarea încărcare)
    setFollowupLog((prev) => [
      {
        id: `local-wa-${Date.now()}`,
        contact_id: c.id,
        sent_at: now,
        status: "whatsapp_initiated",
      },
      ...prev,
    ]);
    setContacts((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? enrichContact({
              ...x,
              last_activity_at: now,
              last_followup_at: now,
              followup_count: newCount,
              status: newStatus,
            }, t)
          : x,
      ),
    );
    setSelectedContact((prev) => {
      if (!prev || prev.id !== c.id) return prev;
      const newEvent = {
        date: todayLabel,
        label: t("dashboard.activity.whatsappSent"),
        type: "whatsapp" as const,
      };
      return {
        ...prev,
        last_activity_at: now,
        last_followup_at: now,
        followup_count: newCount,
        status: newStatus,
        timeline: [newEvent, ...(prev.timeline ?? [])],
      };
    });

    try {
      // followup_log: înregistrăm evenimentul WhatsApp
      const { error: logErr } = await supabase.from("followup_log").insert({
        user_id: user!.id,
        contact_id: c.id,
        sent_at: now,
        status: "whatsapp_initiated",
      });
      if (logErr) console.error("Eroare followup_log:", logErr.message);

      // contacts: updatăm followup_count + status (ca în FollowupModal).
      // NU updatăm last_followup_at — nu e coloană în contacts, se derivă din followup_log.
      const { error: ctErr } = await supabase
        .from("contacts")
        .update({ followup_count: newCount, status: newStatus })
        .eq("id", c.id);
      if (ctErr) console.error("Eroare contacts:", ctErr.message);
    } catch (e) {
      console.error("Eroare log WhatsApp:", e);
    }
  };

  // Construiește timeline real din oferte + follow-up-uri + evenimente contact
  const buildTimeline = (c: Contact): Contact => {
    const events: {
      date: string;
      sortKey: number;
      label: string;
      type: "offer" | "followup" | "email" | "whatsapp" | "event";
      amount?: string;
      offerId?: string;
      external?: boolean;
      sentVia?: string;
    }[] = [];

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString(t("actions.localeCode"), {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });

    // Oferte (sortate descrescător — cea mai nouă prima)
    const contactOffers = offers
      .filter((o) => o.contact_id === c.id)
      .sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );

    // Eticheta canalului pentru ofertele marcate ca trimise extern.
    const channelLabel = (sv?: string) =>
      sv === "phone"
        ? t("contacts.markSent.phone")
        : sv === "other"
          ? t("contacts.markSent.other")
          : t("contacts.markSent.whatsapp");

    contactOffers.forEach((o, idx) => {
      // O ofertă fără produse = marcată manual ca trimisă pe alt canal (€0, fără detalii).
      const isExternal = (o.products_json ?? []).length === 0;
      if (isExternal) {
        events.push({
          date: fmtDate(o.sent_at),
          sortKey: new Date(o.sent_at).getTime(),
          label: t("dashboard.activity.offerSentExternal", {
            channel: channelLabel(o.sent_via),
          }),
          type: "offer",
          external: true,
          sentVia: o.sent_via,
          // fără offerId → nu e clickabilă (nu există ofertă reală de deschis)
        });
      } else {
        events.push({
          date: fmtDate(o.sent_at),
          sortKey: new Date(o.sent_at).getTime(),
          label: t("dashboard.activity.offerSentNumbered", {
            number: contactOffers.length - idx,
          }),
          type: "offer",
          amount: `€${(o.total_eur ?? 0).toFixed(0)}`,
          offerId: o.id,
        });
      }
    });

    // Follow-up-uri / emailuri / WhatsApp — distincte după status
    followupLog
      .filter((f) => f.contact_id === c.id)
      .forEach((f) => {
        const st = (f as { status?: string }).status;
        let type: "followup" | "email" | "whatsapp" = "followup";
        let label = t("dashboard.activity.followupSent");
        if (st === "whatsapp_initiated") {
          type = "whatsapp";
          label = t("dashboard.activity.whatsappSent");
        } else if (st === "sent") {
          type = "email";
          label = t("dashboard.activity.emailSent");
        }
        events.push({
          date: fmtDate(f.sent_at),
          sortKey: new Date(f.sent_at).getTime(),
          label,
          type,
        });
      });

    // Contact creat
    events.push({
      date: fmtDate(c.created_at),
      sortKey: new Date(c.created_at).getTime(),
      label: t("dashboard.activity.contactCreated"),
      type: "event",
    });

    events.sort((a, b) => b.sortKey - a.sortKey);

    // Ultima ofertă (cea mai recentă)
    const latest = contactOffers[0];
    const latestExternal = latest
      ? (latest.products_json ?? []).length === 0
      : false;
    const lastOffer: LastOfferInfo | null = latest
      ? {
          id: latest.id,
          sentAt: latest.sent_at,
          productCount: (latest.products_json ?? []).length,
          totalEur: latest.total_eur ?? 0,
          productNames: (latest.products_json ?? []).map((p) => p.name),
          external: latestExternal,
          sentVia: latest.sent_via,
        }
      : null;

    return {
      ...c,
      timeline: events.map(
        ({ date, label, type, amount, offerId, external, sentVia }) => ({
          date,
          label,
          type,
          amount,
          offerId,
          external,
          sentVia,
        }),
      ),
      offer_products: lastOffer?.productNames ?? c.offer_products,
      last_offer: lastOffer,
    };
  };

  const openContact = (c: Contact) => {
    setSelectedContact(buildTimeline(c));
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "'DM Sans', sans-serif",
          color: T.muted,
          fontSize: 14,
        }}
      >
        {t("dashboard.loading")}
      </div>
    );

  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: T.cream,
        minHeight: "100vh",
      }}
    >
      <style>{`
        @media (min-width: 768px) {
          .aromatool-quick-actions { display: none !important; }
        }
      `}</style>

      {/* ══════════ LAYOUT DESKTOP (≥860px) — 2 coloane ══════════ */}
      {!isMobile && (
        <>
      {/* Top bar */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `0.5px solid ${T.bd}`,
          background: T.wh,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 500, color: T.esp, margin: 0 }}
          >
            {t("dashboard.greetingLine", { greeting: greeting(t), name: firstName })}
          </h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "3px 0 0" }}>
            {focusToday.length > 0
              ? t("dashboard.focusCount", { count: focusToday.length })
              : t("dashboard.allUpToDate")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => navigate("/app/contacts?new=1")}
            style={{
              background: T.sage,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "inherit",
            }}
          >
            <i
              className="ti ti-plus"
              style={{ fontSize: 15 }}
              aria-hidden="true"
            />
            {t("dashboard.newContact")}
          </button>
        </div>
      </div>

      {/* Body 2 coloane */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          minHeight: 0,
        }}
      >
        {/* COLOANA STÂNGA */}
        <div
          style={{ padding: "20px 24px", borderRight: `0.5px solid ${T.bd}` }}
        >
          <LockedOverlay locked={!hasAccess} onUnlock={openPaywall}>
          <SectionTitle
            action={{
              label: t("dashboard.seeAll"),
              onClick: () => navigate("/app/contacts?filter=needs_attention"),
            }}
          >
            {t("dashboard.focusToday")}
          </SectionTitle>

          {focusToday.length === 0 ? (
            <Card>
              <div
                style={{
                  fontSize: 13,
                  color: T.muted,
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                {t("dashboard.focusEmpty")}
              </div>
            </Card>
          ) : (
            focusToday.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => openContact(c)}
                onMarkSent={(ct) => setMarkSentContact(ct)}
              />
            ))
          )}

          {/* Agenda săptămânii — acțiuni viitoare */}
          <div style={{ marginTop: 20 }}>
            <SectionTitle
              action={
                agendaActions.length >= 8
                  ? {
                      label: t("dashboard.seeAll"),
                      onClick: () => navigate("/app/contacts"),
                    }
                  : undefined
              }
            >
              {t("dashboard.weeklyAgenda")}
            </SectionTitle>
            <Card style={{ padding: 0 }}>
              {agendaGroups.length === 0 ? (
                <div
                  style={{
                    padding: "14px",
                    fontSize: 13,
                    color: T.muted,
                    textAlign: "center",
                  }}
                >
                  {t("dashboard.agendaEmpty")}
                </div>
              ) : (
                agendaGroups.map((group, gi) => (
                  <div key={group.label}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: T.sage,
                        padding: "8px 14px 4px",
                        background: T.cream,
                        borderTop: gi > 0 ? `0.5px solid ${T.bd}` : "none",
                      }}
                    >
                      {group.label}
                    </div>
                    {group.actions.map((action, ai) => (
                      <div
                        key={action.contact.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderBottom:
                            gi < agendaGroups.length - 1 ||
                            ai < group.actions.length - 1
                              ? `0.5px solid ${T.bd}`
                              : "none",
                        }}
                      >
                        <div
                          onClick={() => openContact(action.contact)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flex: 1,
                            minWidth: 0,
                            cursor: "pointer",
                          }}
                        >
                          <Avatar contact={action.contact} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: T.esp,
                                }}
                              >
                                {action.contact.name}
                              </span>
                              <span style={{ fontSize: 11, color: T.muted }}>
                                · {displayStatus(action.contact.status, t)}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: T.muted }}>
                              {action.description}
                            </div>
                          </div>
                        </div>
                        {(() => {
                          // Canal corect pe acțiune: dacă emailul lipsește sau
                          // e dezactivat (opt-out), nu mai sugerăm email — oferim
                          // WhatsApp dacă există telefon. Contactele cu comunicarea
                          // blocată sunt deja excluse din agendă.
                          const canEmail =
                            !!action.contact.email &&
                            !action.contact.email_opt_out;
                          const canWhatsApp = !!action.contact.phone;
                          if (!canEmail && !canWhatsApp) return null;
                          const useWa = !canEmail && canWhatsApp;
                          return (
                            <button
                              onClick={() =>
                                useWa
                                  ? handleWhatsApp(action.contact)
                                  : handleEmail(action.contact)
                              }
                              style={{
                                background: useWa ? T.grnLt : T.sageLt,
                                color: useWa ? T.grn : T.sage,
                                border: "none",
                                borderRadius: 7,
                                padding: "6px 14px",
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                flexShrink: 0,
                              }}
                            >
                              {useWa
                                ? t("dashboard.waBtn")
                                : t("dashboard.sendBtn")}
                            </button>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </Card>
          </div>
          </LockedOverlay>
        </div>

        {/* COLOANA DREAPTA */}
        <div style={{ padding: "20px 24px" }}>
          {/* Statistici rapide — cu selector de perioadă (controlează doar statisticile) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: T.muted,
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              {t("dashboard.quickStats")}
            </span>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setPeriodMenuOpen((v) => !v)}
                style={{
                  fontSize: 12,
                  color: T.warm,
                  background: T.linen,
                  borderRadius: 20,
                  padding: "4px 10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <i
                  className="ti ti-calendar"
                  style={{ fontSize: 13 }}
                  aria-hidden="true"
                />
                {period === "today"
                  ? t("dashboard.period.todayFull")
                  : period === "week"
                    ? t("dashboard.period.weekFull")
                    : t("dashboard.period.monthFull")}
                <i
                  className={`ti ti-chevron-${periodMenuOpen ? "up" : "down"}`}
                  style={{ fontSize: 12 }}
                  aria-hidden="true"
                />
              </div>
              {periodMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    background: "#fff",
                    border: `0.5px solid ${T.bd}`,
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(61,53,48,.12)",
                    zIndex: 5,
                    overflow: "hidden",
                    minWidth: 160,
                  }}
                >
                  {(
                    [
                      ["today", t("dashboard.period.todayFull")],
                      ["week", t("dashboard.period.weekFull")],
                      ["month", t("dashboard.period.monthFull")],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => {
                        setPeriod(val);
                        setPeriodMenuOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: val === period ? T.cream : "#fff",
                        border: "none",
                        borderBottom: `0.5px solid ${T.linen}`,
                        padding: "9px 12px",
                        fontSize: 13,
                        color: T.esp,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                    >
                      {label}
                      {val === period && (
                        <i
                          className="ti ti-check"
                          style={{ fontSize: 14, color: T.sage }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <StatBox
              label={t("dashboard.stats.contactsAdded")}
              value={newContactsInPeriod}
              delta={periodLabel}
            />
            <StatBox
              label={t("dashboard.stats.activeClients")}
              value={activeClients}
              delta={t("dashboard.stats.activeClientsDelta", { total: totalContacts })}
            />
            <StatBox
              label={t("dashboard.stats.offersSent")}
              value={offersCountPeriod}
              delta={periodLabel}
            />
            <StatBox
              label={t("dashboard.stats.offersValue")}
              value={`€${valuePeriod.toFixed(0)}`}
              delta={periodLabel}
            />
          </div>

          {/* Activitate recentă */}
          <SectionTitle
            action={{
              label: t("dashboard.seeAllFem"),
              onClick: () => navigate("/app/offers"),
            }}
          >
            {t("dashboard.recentActivity")}
          </SectionTitle>
          <Card style={{ padding: 0 }}>
            {recentActivity.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  fontSize: 13,
                  color: T.muted,
                  textAlign: "center",
                }}
              >
                {t("dashboard.noActivity")}
              </div>
            ) : (
              recentActivity.map((item, i) => {
                const iconConfig = {
                  offer: {
                    icon: "ti-file-text",
                    bg: T.roseLt,
                    color: "#D4A5A0",
                  },
                  email: { icon: "ti-mail", bg: T.lavLt, color: T.lav },
                  followup: { icon: "ti-send", bg: T.lavLt, color: T.lav },
                  whatsapp: {
                    icon: "ti-brand-whatsapp",
                    bg: T.grnLt,
                    color: T.grn,
                  },
                }[item.kind];
                return (
                  <div
                    key={item.id}
                    onClick={() => item.contact && openContact(item.contact)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      borderBottom:
                        i < recentActivity.length - 1
                          ? `0.5px solid ${T.bd}`
                          : "none",
                      cursor: item.contact ? "pointer" : "default",
                    }}
                    onMouseEnter={(e) => {
                      if (item.contact)
                        e.currentTarget.style.background = T.cream;
                    }}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        flexShrink: 0,
                        background: iconConfig.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className={`ti ${iconConfig.icon}`}
                        style={{ fontSize: 14, color: iconConfig.color }}
                        aria-hidden="true"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontSize: 12, fontWeight: 500, color: T.esp }}
                      >
                        {item.contact?.name ?? t("dashboard.deletedContact")}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {item.label}
                        {item.amount ? ` · ${item.amount}` : ""}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {daysSince(item.at) === 0
                        ? t("dashboard.today")
                        : t("dashboard.daysAgo", { count: daysSince(item.at) })}
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
        </>
      )}

      {/* ══════════ LAYOUT MOBIL (<860px) — single-column, carduri ══════════ */}
      {isMobile && (
        <>
          {/* Header-ul de brand vine din AppLayout (logo + meniu user).
              Nu îl mai dublăm aici — pornim direct cu cardul de salut. */}
          <div style={{ padding: "14px 0 8px", margin: "0 -4px" }}>
            {/* Card salut */}
            <div
              style={{
                background: T.wh,
                border: `0.5px solid ${T.bd}`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 600, color: T.esp }}>
                  {t("dashboard.greetingLine", {
                    greeting: greeting(t),
                    name: firstName,
                  })}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: T.muted,
                    marginTop: 3,
                    textTransform: "capitalize",
                  }}
                >
                  {new Date().toLocaleDateString(
                    i18n.language === "ro" ? "ro-RO" : "en-US",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate("/app/contacts?new=1")}
                style={{
                  background: T.sage,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "inherit",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <IconPlus size={16} color="#fff" />
                {t("dashboard.newContact")}
              </button>
            </div>

            <LockedOverlay locked={!hasAccess} onUnlock={openPaywall}>
            {/* Card FOCUS TODAY */}
            <MCard>
              <MHeader
                icon={<IconTarget size={17} color={T.sage} />}
                title={t("dashboard.focusToday")}
                actionLabel={t("dashboard.seeAll")}
                onAction={() =>
                  navigate("/app/contacts?filter=needs_attention")
                }
              />
              {(focusTotal > 0 || focusToday.length > 0) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: focusToday.length > 0 ? 14 : 4,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 34,
                        fontWeight: 600,
                        color: T.esp,
                        lineHeight: 1,
                      }}
                    >
                      {focusToday.length}
                    </div>
                    <div
                      style={{ fontSize: 13, color: T.muted, marginTop: 4 }}
                    >
                      {t("dashboard.focusActionsForToday")}
                    </div>
                  </div>
                  <ProgressRing
                    percent={focusPercent}
                    label={t("dashboard.completed")}
                  />
                </div>
              )}
              {focusToday.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: T.muted,
                    textAlign: "center",
                    padding: "10px 0",
                  }}
                >
                  {focusTotal > 0
                    ? t("dashboard.focusAllDone")
                    : t("dashboard.focusEmpty")}
                </div>
              ) : (
                <>
                  {(focusExpanded ? focusToday : focusToday.slice(0, 3)).map(
                    (c) => (
                      <ContactCard
                        key={c.id}
                        contact={c}
                        onClick={() => openContact(c)}
                        onMarkSent={(ct) => setMarkSentContact(ct)}
                        mobile
                      />
                    ),
                  )}
                  {focusToday.length > 3 && (
                    <button
                      onClick={() => setFocusExpanded((v) => !v)}
                      style={{
                        width: "100%",
                        textAlign: "center",
                        background: "none",
                        border: "none",
                        color: T.sage,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: "8px 0 2px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {focusExpanded
                        ? t("dashboard.showLess")
                        : t("dashboard.moreActions", {
                            count: focusToday.length - 3,
                          })}
                    </button>
                  )}
                </>
              )}
            </MCard>

            {/* Card AGENDA SĂPTĂMÂNII */}
            <MCard style={{ padding: "14px 0 6px" }}>
              <div style={{ padding: "0 14px" }}>
                <MHeader
                  icon={<IconCal size={16} color={T.sage} />}
                  title={t("dashboard.weeklyAgenda")}
                  actionLabel={
                    agendaActions.length >= 8
                      ? t("dashboard.seeAll")
                      : undefined
                  }
                  onAction={
                    agendaActions.length >= 8
                      ? () => navigate("/app/contacts")
                      : undefined
                  }
                />
              </div>
              {agendaGroups.length === 0 ? (
                <div
                  style={{
                    padding: "6px 14px 12px",
                    fontSize: 13,
                    color: T.muted,
                    textAlign: "center",
                  }}
                >
                  {t("dashboard.agendaEmpty")}
                </div>
              ) : (
                agendaGroups.map((group) => (
                  <div key={group.label}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.sage,
                        padding: "8px 14px 4px",
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      {group.label}
                    </div>
                    {group.actions.map((action) => {
                      const canEmail =
                        !!action.contact.email &&
                        !action.contact.email_opt_out;
                      const canWhatsApp = !!action.contact.phone;
                      const useWa = !canEmail && canWhatsApp;
                      const showBtn = canEmail || canWhatsApp;
                      return (
                        <div
                          key={action.contact.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 11,
                            padding: "10px 14px",
                          }}
                        >
                          <div
                            onClick={() => openContact(action.contact)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 11,
                              flex: 1,
                              minWidth: 0,
                              cursor: "pointer",
                            }}
                          >
                            <Avatar contact={action.contact} size={34} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "baseline",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: T.esp,
                                  }}
                                >
                                  {action.contact.name}
                                </span>
                                <span
                                  style={{ fontSize: 11, color: T.muted }}
                                >
                                  · {displayStatus(action.contact.status, t)}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: T.muted,
                                  marginTop: 1,
                                }}
                              >
                                {action.description}
                              </div>
                            </div>
                          </div>
                          {showBtn && (
                            <button
                              onClick={() =>
                                useWa
                                  ? handleWhatsApp(action.contact)
                                  : handleEmail(action.contact)
                              }
                              style={{
                                background: useWa ? T.grnLt : T.sageLt,
                                color: useWa ? T.grn : T.sage,
                                border: "none",
                                borderRadius: 9,
                                padding: "8px 14px",
                                fontSize: 12.5,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                flexShrink: 0,
                              }}
                            >
                              {useWa
                                ? t("dashboard.waBtn")
                                : t("dashboard.sendBtn")}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </MCard>
            </LockedOverlay>

            {/* Card STATISTICI RAPIDE */}
            <MCard>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 9 }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: T.sageLt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconChart size={16} color={T.sage} />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.warm,
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                    }}
                  >
                    {t("dashboard.quickStats")}
                  </span>
                </div>
                <PeriodSelectorMobile
                  period={period}
                  setPeriod={setPeriod}
                  t={t}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <MStat
                  icon={<IconUsers size={18} color={T.sage} />}
                  bg={T.sageLt}
                  value={newContactsInPeriod}
                  label={t("dashboard.stats.contactsAdded")}
                  sub={periodLabel}
                />
                <MStat
                  icon={<IconUser size={18} color={T.lav} />}
                  bg={T.lavLt}
                  value={activeClients}
                  label={t("dashboard.stats.activeClients")}
                  sub={t("dashboard.stats.activeClientsDelta", {
                    total: totalContacts,
                  })}
                />
                <MStat
                  icon={<IconBag size={18} color={T.amb} />}
                  bg={T.ambLt}
                  value={offersCountPeriod}
                  label={t("dashboard.stats.offersSent")}
                  sub={periodLabel}
                />
                <MStat
                  icon={<IconEuro size={18} color={T.grn} />}
                  bg={T.grnLt}
                  value={`€${valuePeriod.toFixed(0)}`}
                  label={t("dashboard.stats.offersValue")}
                  sub={periodLabel}
                />
              </div>
            </MCard>

            {/* Card ACTIVITATE RECENTĂ */}
            <MCard style={{ padding: "14px 0 6px" }}>
              <div style={{ padding: "0 14px" }}>
                <MHeader
                  icon={<IconClock size={16} color={T.sage} />}
                  title={t("dashboard.recentActivity")}
                />
              </div>
              {recentActivity.length === 0 ? (
                <div
                  style={{
                    padding: "6px 14px 12px",
                    fontSize: 13,
                    color: T.muted,
                    textAlign: "center",
                  }}
                >
                  {t("dashboard.noActivity")}
                </div>
              ) : (
                <>
                  {recentActivity.map((item) => {
                    const cfg = {
                      offer: {
                        icon: <IconFile size={15} color="#C98A86" />,
                        bg: T.roseLt,
                      },
                      email: {
                        icon: <IconMail size={15} color={T.lav} />,
                        bg: T.lavLt,
                      },
                      followup: {
                        icon: <IconSend size={15} color={T.lav} />,
                        bg: T.lavLt,
                      },
                      whatsapp: {
                        icon: <IconWhats size={15} color={T.grn} />,
                        bg: T.grnLt,
                      },
                    }[item.kind];
                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          item.contact && openContact(item.contact)
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          padding: "10px 14px",
                          cursor: item.contact ? "pointer" : "default",
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
                          {cfg.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 500,
                              color: T.esp,
                            }}
                          >
                            {item.contact?.name ??
                              t("dashboard.deletedContact")}
                          </div>
                          <div style={{ fontSize: 12, color: T.muted }}>
                            {item.label}
                            {item.amount ? ` · ${item.amount}` : ""}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: T.muted,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {daysSince(item.at) === 0
                            ? t("dashboard.today")
                            : t("dashboard.daysAgo", {
                                count: daysSince(item.at),
                              })}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => navigate("/app/offers")}
                    style={{
                      width: "100%",
                      textAlign: "center",
                      background: "none",
                      border: "none",
                      color: T.sage,
                      fontSize: 13,
                      fontWeight: 500,
                      padding: "10px 0 4px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t("dashboard.seeAllActivity")} →
                  </button>
                </>
              )}
            </MCard>
          </div>
        </>
      )}

      {/* Contact detail — bottom-sheet pe mobil, slide-over pe desktop */}
      {isMobile ? (
        <ContactQuickSheet
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onWhatsApp={handleWhatsApp}
          onEmail={handleEmail}
          onOffer={handleOffer}
          onMarkSent={(c) => {
            setSelectedContact(null);
            setMarkSentContact(c);
          }}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onOpenOffer={(offerId: string) =>
            navigate(`/app/offers?offer=${offerId}`)
          }
          onViewFullProfile={(c) =>
            navigate(`/app/contacts?contact=${c.id}`)
          }
        />
      ) : (
        <ContactSlideOver
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onWhatsApp={handleWhatsApp}
          onEmail={handleEmail}
          onOffer={handleOffer}
          onMarkSent={(c) => {
            setSelectedContact(null);
            setMarkSentContact(c);
          }}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          onOpenOffer={(offerId: string) =>
            navigate(`/app/offers?offer=${offerId}`)
          }
        />
      )}

      {/* Follow-up modal */}
      {followupContact && (
        <FollowupModal
          contact={followupContact}
          action={getActionType(followupContact)}
          onClose={() => setFollowupContact(null)}
          onSent={(contactId: string) => {
            const now = new Date().toISOString();
            setContacts((prev) =>
              prev.map((c) =>
                c.id === contactId
                  ? enrichContact({
                      ...c,
                      followup_count: (c.followup_count ?? 0) + 1,
                      last_followup_at: now,
                      last_activity_at: now,
                      status:
                        c.status === "prospect" ? "in_followup" : c.status,
                    }, t)
                  : c,
              ),
            );
            setFollowupLog((prev) => [
              {
                id: `local-${Date.now()}`,
                contact_id: contactId,
                sent_at: now,
                status: "sent",
              },
              ...prev,
            ]);
            setFollowupContact(null);
          }}
        />
      )}

      {/* Picker canal „Marchează oferta ca trimisă" */}
      {markSentContact && (
        <div
          onClick={() => !markSentSaving && setMarkSentContact(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(61,53,48,0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.wh,
              borderRadius: 18,
              padding: 24,
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 20px 60px rgba(61,53,48,0.25)",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: T.sageLt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <i
                className="ti ti-circle-check"
                style={{ fontSize: 22, color: T.sage }}
              />
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: T.esp,
                marginBottom: 6,
              }}
            >
              {t("contacts.markSent.title")}
            </div>
            <div
              style={{
                fontSize: 13,
                color: T.warm,
                lineHeight: 1.55,
                marginBottom: 18,
              }}
            >
              {t("contacts.markSent.subtitle")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(
                [
                  ["whatsapp", "ti-brand-whatsapp"],
                  ["phone", "ti-phone"],
                  ["other", "ti-dots"],
                ] as const
              ).map(([ch, icon]) => (
                <button
                  key={ch}
                  onClick={() => handleMarkSent(ch)}
                  disabled={markSentSaving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: T.cream,
                    border: `0.5px solid ${T.bd}`,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    color: T.esp,
                    cursor: markSentSaving ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    opacity: markSentSaving ? 0.6 : 1,
                  }}
                >
                  <i
                    className={`ti ${icon}`}
                    style={{ fontSize: 18, color: T.sage }}
                  />
                  {t(`contacts.markSent.${ch}`)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMarkSentContact(null)}
              disabled={markSentSaving}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "10px",
                background: "none",
                border: "none",
                color: T.muted,
                fontSize: 13,
                cursor: markSentSaving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {markSentSaving
                ? t("contacts.markSent.saving")
                : t("contacts.markSent.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Toast confirmare marcare */}
      {markSentToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            background: T.esp,
            color: T.wh,
            padding: "12px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 8px 30px rgba(61,53,48,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: "90vw",
          }}
        >
          <i
            className="ti ti-circle-check"
            style={{ fontSize: 17, color: T.sageMid }}
          />
          {markSentToast}
        </div>
      )}
    </div>
  );
}
