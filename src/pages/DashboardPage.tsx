import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useCartStore } from "../hooks/useCartStore";
import ContactSlideOver from "../components/ContactSlideOver";
import FollowupModal from "../components/FollowupModal";
import { openWhatsApp, startOffer } from "../lib/contactActions";
import {
  getRecommendedAction,
  displayStatus,
  ACTIONABLE_TYPES,
  shortReason,
  getNextAction,
  groupLabel,
} from "../lib/recommendedAction";
import type { ActionType } from "../lib/recommendedAction";
import type { ContactStatus } from "../lib/relationshipScore";

export interface ContactTimeline {
  date: string;
  label: string;
  type: "offer" | "followup" | "email" | "whatsapp" | "event";
  amount?: string;
  offerId?: string;
}

export interface LastOfferInfo {
  id: string;
  sentAt: string;
  productCount: number;
  totalEur: number;
  productNames: string[];
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: ContactStatus;
  notes?: string;
  source?: string | null;
  created_at: string;
  updated_at?: string | null;
  first_offer_at?: string | null;
  last_activity_at?: string | null;
  followup_count?: number;
  followup_opted_out?: boolean;
  last_followup_at?: string | null;
  offers_count?: number;
  total_eur?: number;
  manual_high_interest?: boolean;
  manual_business_interest?: boolean;
  email_opens?: number | null;
  email_clicks?: number | null;
  offer_products?: string[];
  last_offer?: LastOfferInfo | null;
  timeline?: ContactTimeline[];
  // UI helpers
  avatarBg?: string;
  avatarColor?: string;
  statusLabel?: string;
  statusBg?: string;
  statusColor?: string;
  urgentLabel?: string;
  urgencyDays?: number;
  urgencyLabel?: string;
  urgencyColor?: string;
  barColor?: string;
  actionText?: string;
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bună dimineața";
  if (h < 18) return "Bună ziua";
  return "Bună seara";
}

function enrichContact(c: Contact): Contact {
  const statusMap: Record<
    ContactStatus,
    { label: string; bg: string; color: string }
  > = {
    prospect: { label: "Prospect", bg: T.ambLt, color: T.amb },
    in_followup: { label: "În follow-up", bg: T.lavLt, color: T.lav },
    inactiv: { label: "Inactiv", bg: T.redLt, color: T.red },
    client_nou: { label: "Client nou", bg: T.sageLt, color: T.sage },
    client_fidel: { label: "Client fidel", bg: T.sageLt, color: T.sage },
    team_member: { label: "Membru echipă", bg: T.lavLt, color: T.lav },
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

  if (c.status === "inactiv" || daysSinceActivity >= 60) {
    urgentLabel = "Client în risc";
    urgencyDays = daysSinceActivity;
    urgencyLabel = "zile inactivă";
    urgencyColor = T.red;
    barColor = T.red;
    actionText = "Reactivează";
  } else if (c.status === "prospect" && (c.offers_count ?? 0) === 0) {
    urgencyDays = inCRM;
    urgencyLabel = "zile în CRM";
    urgencyColor = T.amb;
    barColor = T.amb;
    actionText = "Trimite ofertă";
  } else if (c.status === "in_followup") {
    urgencyDays = daysSinceOffer;
    urgencyLabel = "zile de la ofertă";
    urgencyColor = T.lav;
    barColor = T.lav;
    actionText = "Follow-up";
  } else if (c.status === "client_nou" || c.status === "client_fidel") {
    urgencyDays = daysSinceActivity;
    urgencyLabel = "zile de la ultima activitate";
    urgencyColor = T.grn;
    barColor = T.grn;
    actionText = "Contactează";
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

function initials(name: string): string {
  return name
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
}: {
  contact: Contact;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const action = getRecommendedAction(contact);
  const reason = shortReason(contact);
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
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 11,
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
      <Avatar contact={contact} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.esp }}>
            {contact.name}
          </span>
          <span style={{ fontSize: 11, color: T.muted }}>
            · {displayStatus(contact.status)}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span
            style={{
              color: highlighted ? action.accentColor : T.warm,
              fontWeight: highlighted ? 500 : 400,
            }}
          >
            {action.title}
          </span>
          <span style={{ color: T.muted }}>·</span>
          <span style={{ color: T.muted }}>{reason}</span>
        </div>
      </div>
      {highlighted && (
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
          {isUrgent ? "Urgent" : "Atenție"}
        </span>
      )}
      <i
        className="ti ti-chevron-right"
        style={{ fontSize: 15, color: T.muted }}
        aria-hidden="true"
      />
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

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    }[]
  >([]);
  const [followupLog, setFollowupLog] = useState<
    { id: string; contact_id: string; sent_at: string; status?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [followupContact, setFollowupContact] = useState<Contact | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);

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
            .select("id,contact_id,total_eur,sent_at,currency,products_json")
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
        const enriched = ctcts.map((c) => {
          // Agregare oferte per contact — câmpurile NU există în tabela contacts
          const contactOffers = offersList.filter((o) => o.contact_id === c.id);
          const offersCount = contactOffers.length;
          const totalEur = contactOffers.reduce(
            (s, o) => s + (o.total_eur ?? 0),
            0,
          );

          // Ultima activitate = cel mai recent dintre: ultima ofertă, ultimul follow-up, updated_at
          const contactFu = fuLogList.filter((f) => f.contact_id === c.id);
          const lastFollowupAt =
            contactFu.length > 0
              ? contactFu.reduce(
                  (latest, f) =>
                    new Date(f.sent_at) > new Date(latest) ? f.sent_at : latest,
                  contactFu[0].sent_at,
                )
              : null;
          const activityDates = [
            ...contactOffers.map((o) => o.sent_at),
            ...contactFu.map((f) => f.sent_at),
            (c as Contact).updated_at,
          ].filter(Boolean) as string[];
          const lastActivityAt =
            activityDates.length > 0
              ? activityDates.reduce((latest, d) =>
                  new Date(d) > new Date(latest) ? d : latest,
                )
              : null;

          // Prima ofertă (cea mai veche)
          const firstOfferAt =
            contactOffers.length > 0
              ? contactOffers.reduce(
                  (earliest, o) =>
                    new Date(o.sent_at) < new Date(earliest)
                      ? o.sent_at
                      : earliest,
                  contactOffers[0].sent_at,
                )
              : ((c as Contact).first_offer_at ?? null);

          return enrichContact({
            ...(c as Contact),
            offers_count: offersCount,
            total_eur: totalEur,
            last_activity_at: lastActivityAt,
            last_followup_at: lastFollowupAt,
            first_offer_at: firstOfferAt,
          });
        });
        setContacts(enriched);
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
      ? "azi"
      : period === "week"
        ? "săptămâna asta"
        : "luna asta";
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

  const firstName = profile?.full_name?.split(" ")[0] ?? "tu";

  // Statistici
  const totalContacts = contacts.length;
  const activeClients = contacts.filter(
    (c) => c.status === "client_nou" || c.status === "client_fidel",
  ).length;

  // Focus today — contacte cu acțiune urgentă, sortate după prioritate
  const ACTION_PRIORITY: ActionType[] = [
    "reactivate",
    "needs_offer",
    "needs_followup",
    "discuss_business",
  ];
  const focusToday = contacts
    .map((c) => ({ contact: c, action: getRecommendedAction(c) }))
    .filter((x) => ACTIONABLE_TYPES.includes(x.action.type))
    .sort(
      (a, b) =>
        ACTION_PRIORITY.indexOf(a.action.type) -
        ACTION_PRIORITY.indexOf(b.action.type),
    )
    .slice(0, 5)
    .map((x) => x.contact);

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
    ...offers.map((o) => ({
      id: `offer-${o.id}`,
      contactId: o.contact_id,
      kind: "offer" as const,
      label: "Ofertă trimisă",
      amount: `€${(o.total_eur ?? 0).toFixed(0)}`,
      at: o.sent_at,
    })),
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
          ? "WhatsApp trimis"
          : isEmail
            ? "Email trimis"
            : "Follow-up trimis",
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
    .map((c) => getNextAction(c, followUpDays))
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  // Grupare pe etichete temporale, păstrând ordinea
  const agendaGroups: { label: string; actions: typeof agendaActions }[] = [];
  for (const action of agendaActions) {
    const label = groupLabel(action.date, action.daysUntil);
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
            })
          : c,
      ),
    );
    setSelectedContact((prev) =>
      prev && prev.id === contactId
        ? enrichContact({ ...prev, status: newStatus })
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
    const todayLabel = new Date(now).toLocaleDateString("ro-RO", {
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
            })
          : x,
      ),
    );
    setSelectedContact((prev) => {
      if (!prev || prev.id !== c.id) return prev;
      const newEvent = {
        date: todayLabel,
        label: "WhatsApp trimis",
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
    }[] = [];

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString("ro-RO", {
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

    contactOffers.forEach((o, idx) => {
      events.push({
        date: fmtDate(o.sent_at),
        sortKey: new Date(o.sent_at).getTime(),
        label: `Ofertă trimisă #${contactOffers.length - idx}`,
        type: "offer",
        amount: `€${(o.total_eur ?? 0).toFixed(0)}`,
        offerId: o.id,
      });
    });

    // Follow-up-uri / emailuri / WhatsApp — distincte după status
    followupLog
      .filter((f) => f.contact_id === c.id)
      .forEach((f) => {
        const st = (f as { status?: string }).status;
        let type: "followup" | "email" | "whatsapp" = "followup";
        let label = "Follow-up trimis";
        if (st === "whatsapp_initiated") {
          type = "whatsapp";
          label = "WhatsApp trimis";
        } else if (st === "sent") {
          type = "email";
          label = "Email trimis";
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
      label: "Contact creat",
      type: "event",
    });

    events.sort((a, b) => b.sortKey - a.sortKey);

    // Ultima ofertă (cea mai recentă)
    const latest = contactOffers[0];
    const lastOffer: LastOfferInfo | null = latest
      ? {
          id: latest.id,
          sentAt: latest.sent_at,
          productCount: (latest.products_json ?? []).length,
          totalEur: latest.total_eur ?? 0,
          productNames: (latest.products_json ?? []).map((p) => p.name),
        }
      : null;

    return {
      ...c,
      timeline: events.map(({ date, label, type, amount, offerId }) => ({
        date,
        label,
        type,
        amount,
        offerId,
      })),
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
        Se încarcă...
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
            {greeting()}, {firstName}! 🌿
          </h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "3px 0 0" }}>
            {focusToday.length > 0
              ? `Ai ${focusToday.length} ${focusToday.length === 1 ? "acțiune care merită" : "acțiuni care merită"} atenția ta azi.`
              : "Totul e la zi. Zi productivă!"}
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
            Contact nou
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
          <SectionTitle
            action={{
              label: "Vezi toate",
              onClick: () => navigate("/app/contacts?filter=needs_attention"),
            }}
          >
            Focus today
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
                Totul e la zi! Nicio acțiune urgentă. 🌿
              </div>
            </Card>
          ) : (
            focusToday.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => openContact(c)}
              />
            ))
          )}

          {/* Agenda săptămânii — acțiuni viitoare */}
          <div style={{ marginTop: 20 }}>
            <SectionTitle
              action={
                agendaActions.length >= 8
                  ? {
                      label: "Vezi toate",
                      onClick: () => navigate("/app/contacts"),
                    }
                  : undefined
              }
            >
              Agenda săptămânii
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
                  Nimic programat momentan. 🌿
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
                                · {displayStatus(action.contact.status)}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: T.muted }}>
                              {action.description}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleEmail(action.contact)}
                          style={{
                            background: T.sageLt,
                            color: T.sage,
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
                          Trimite
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </Card>
          </div>
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
              Statistici rapide
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
                  ? "Astăzi"
                  : period === "week"
                    ? "Săptămâna aceasta"
                    : "Luna aceasta"}
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
                      ["today", "Astăzi"],
                      ["week", "Săptămâna aceasta"],
                      ["month", "Luna aceasta"],
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
              label="Contacte adăugate"
              value={newContactsInPeriod}
              delta={periodLabel}
            />
            <StatBox
              label="Clienți activi"
              value={activeClients}
              delta={`din ${totalContacts} total`}
            />
            <StatBox
              label="Oferte trimise"
              value={offersCountPeriod}
              delta={periodLabel}
            />
            <StatBox
              label="Valoare oferte trimise"
              value={`€${valuePeriod.toFixed(0)}`}
              delta={periodLabel}
            />
          </div>

          {/* Activitate recentă */}
          <SectionTitle
            action={{
              label: "Vezi toată",
              onClick: () => navigate("/app/offers"),
            }}
          >
            Activitate recentă
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
                Nicio activitate încă.
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
                        {item.contact?.name ?? "Contact șters"}
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
                        ? "Azi"
                        : `Acum ${daysSince(item.at)} zile`}
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>

      {/* Slide-over contact */}
      <ContactSlideOver
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        onWhatsApp={handleWhatsApp}
        onEmail={handleEmail}
        onOffer={handleOffer}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
        onOpenOffer={(offerId: string) =>
          navigate(`/app/offers?offer=${offerId}`)
        }
      />

      {/* Follow-up modal */}
      {followupContact && (
        <FollowupModal
          contact={followupContact}
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
                    })
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
    </div>
  );
}
