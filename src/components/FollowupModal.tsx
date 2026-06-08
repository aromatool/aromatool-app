import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { ActionType } from "../lib/recommendedAction";
import { EMAIL_HEADER_HTML } from "../lib/emailLogo";
import { createResourceLinks } from "../lib/resourceLink";
import { buildEmailFooter } from "../lib/emailFooter";
import { useResources } from "../hooks/useResources";

// Acțiunile care au mesaje recomandate (awaiting_reply/none nu declanșează nimic
// special — folosim mesajele de follow-up ca fallback util).
const ACTION_LABEL: Record<string, string> = {
  needs_offer: "Trimite prima ofertă",
  needs_followup: "Trimite follow-up",
  reactivate: "Reactivează contactul",
  discuss_business: "Discută despre business",
};

// Mapează acțiunea recomandată → ce mesaje încărcăm (trigger_action).
function messageActionFor(action?: ActionType): string {
  switch (action) {
    case "needs_offer":
      return "needs_offer";
    case "reactivate":
      return "reactivate";
    case "discuss_business":
      return "discuss_business";
    // needs_followup, awaiting_reply, none, undefined → mesaje de follow-up
    default:
      return "needs_followup";
  }
}

const C = {
  card: "#FFFFFF",
  border: "#EDE8E0",
  border2: "#C8D8C8",
  primary: "#5C7A5C",
  primaryDark: "#4A6A4A",
  dark: "#3D3530",
  muted: "#A89888",
  text2: "#6A5A50",
  bg2: "#F5EEE8",
  sageLight: "#E8F0E8",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  red: "#C94F6A",
  redbg: "#FFF0F4",
};

interface Template {
  id: string;
  subject: string;
  body_html: string;
  title: string | null;
  trigger_action: string | null;
  active: boolean;
  user_id: string | null; // null = mesaj de sistem (global)
}

interface TemplateBody {
  type: string;
  headline: string;
  intro: string;
  cta: string;
  closing: string;
}

interface Contact {
  id: string;
  email?: string;
  name: string | null;
  phone?: string | null;
  status?: string;
  followup_count?: number;
  email_opt_out?: boolean;
  communication_blocked?: boolean;
}

interface LastOffer {
  products_json: Array<{
    name: string;
    qty: number;
    price_eur: number;
    disc: number;
  }>;
  total_display: number;
  currency: string;
  exchange_rate: number;
  sent_at?: string;
}

function parseBody(body_html: string): TemplateBody {
  try {
    return JSON.parse(body_html);
  } catch {
    return {
      type: "",
      headline: "",
      intro: "",
      cta: "Scrie-mi",
      closing: "Cu drag",
    };
  }
}

function replaceVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v),
    text,
  );
}

interface ResourceLink {
  title: string;
  url: string;
}

function buildEmailHtml(
  body: TemplateBody,
  vars: Record<string, string>,
  lastOffer: LastOffer | null,
  userName: string,
  userSignature?: string,
  resourceLinks: ResourceLink[] = [],
  userPhone?: string,
  userEmail?: string,
): string {
  const headline = replaceVars(body.headline, vars);
  const intro = replaceVars(body.intro, vars);

  const resourceButtons =
    resourceLinks.length > 0
      ? `<div style="margin-bottom:20px;padding:16px;background:#FAFAF7;border-radius:10px;border:1px solid #E8F0E8;">
      <div style="font-size:10px;color:#5C7A5C;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:10px;font-family:'Helvetica Neue',Arial,sans-serif">Materiale atașate</div>
      ${resourceLinks
        .map(
          (r) => `<a href="${r.url}" style="display:block;margin-bottom:8px;padding:11px 16px;background:#5C7A5C;border-radius:8px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif">📎 ${r.title}</a>`,
        )
        .join("")}
    </div>`
      : "";

  const productsHtml =
    lastOffer?.products_json
      ?.map((p) => {
        const total =
          p.price_eur *
          p.qty *
          (1 - p.disc / 100) *
          (lastOffer.exchange_rate || 1);
        return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#3D3530">${p.name}${p.disc > 0 ? ` <span style="color:#C94F6A;font-size:11px">−${p.disc}%</span>` : ""}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#A89888;text-align:center">×${p.qty}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;font-weight:600;color:#4A6A4A;text-align:right">${total.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lastOffer.currency || "RON"}</td>
    </tr>`;
      })
      .join("") || "";

  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#FAFAF7;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8E0;">
  ${EMAIL_HEADER_HTML}
  <div style="padding:28px;">
    <p style="font-size:16px;color:#4A6A4A;font-weight:600;margin:0 0 14px;text-align:center">${headline}</p>
    <p style="font-size:13px;color:#6A5A50;line-height:1.8;margin:0 0 20px;white-space:pre-wrap">${intro}</p>
    ${
      lastOffer
        ? `<div style="margin-bottom:20px;">
      <div style="font-size:11px;color:#A89888;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:8px">Oferta anterioară</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #EDE8E0;border-radius:10px;overflow:hidden;">
        <thead><tr style="background:#F5EEE8;">
          <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:left;font-weight:500">Produs</th>
          <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:center;font-weight:500">Cant.</th>
          <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:right;font-weight:500">Total</th>
        </tr></thead>
        <tbody>${productsHtml}</tbody>
      </table>
      <div style="text-align:right;margin-top:8px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <span style="font-size:13px;color:#A89888">Total: </span>
        <span style="font-size:18px;font-weight:700;color:#4A6A4A">${lastOffer.total_display?.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${lastOffer.currency || "RON"}</span>
      </div>
    </div>`
        : ""
    }
    ${resourceButtons}
  </div>
  ${buildEmailFooter({ userName, userPhone, userEmail, userSignature })}
  <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
    <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
  </div>
</div></body></html>`;
}

// Email custom — layout simplu, mesaj liber
function buildCustomHtml(
  message: string,
  userName: string,
  userSignature?: string,
  userPhone?: string,
  userEmail?: string,
): string {
  const safe = message.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#FAFAF7;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8E0;">
  ${EMAIL_HEADER_HTML}
  <div style="padding:28px;">
    <p style="font-size:14px;color:#3D3530;line-height:1.8;margin:0 0 20px;white-space:pre-wrap">${safe}</p>
  </div>
  ${buildEmailFooter({ userName, userPhone, userEmail, userSignature })}
  <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
    <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
  </div>
</div></body></html>`;
}

interface FollowupModalProps {
  contact: Contact;
  onClose: () => void;
  onSent: (contactId: string) => void;
  action?: ActionType; // acțiunea recomandată — determină ce mesaje sugerăm
}

type Tab = "template" | "custom";

export default function FollowupModal({
  contact,
  onClose,
  onSent,
  action,
}: FollowupModalProps) {
  const { user } = useAuth();
  const { resources } = useResources();
  const [tab, setTab] = useState<Tab>("template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lastOffer, setLastOffer] = useState<LastOffer | null>(null);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userSignature, setUserSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");

  // Custom email
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const selected = templates.find((t) => t.id === selectedId);
  const selectedBody = selected ? parseBody(selected.body_html) : null;

  // Lista afișată: doar recomandate (filtrate pe acțiune) sau toate.
  const currentAction = messageActionFor(action);
  const visibleTemplates = showAll
    ? templates
    : templates.filter((t) => t.trigger_action === currentAction);

  const vars: Record<string, string> = {
    "{{nume}}": contact.name || (contact.email ?? "").split("@")[0],
    "{{email}}": contact.email ?? "",
    "{{zile}}": lastOffer?.sent_at
      ? String(
          Math.floor(
            (Date.now() - new Date(lastOffer.sent_at).getTime()) / 86400000,
          ),
        )
      : "?",
    "{{produse}}":
      lastOffer?.products_json
        ?.map((p) => `• ${p.name} ×${p.qty}`)
        .join("\n") || "",
    "{{total}}": lastOffer
      ? `${lastOffer.total_display?.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${lastOffer.currency}`
      : "",
    "{{distribuitor}}": userName,
    "{{telefon}}": userPhone,
  };

  useEffect(() => {
    loadData();
  }, []);

  // La schimbarea mesajului → încarcă resursele implicite (template_resources).
  // Mesajele de sistem nu au resurse implicite (owner-only) → listă goală.
  useEffect(() => {
    if (!selectedId) {
      setSelectedResourceIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("template_resources")
        .select("resource_id")
        .eq("template_id", selectedId)
        .eq("user_id", user!.id);
      if (!cancelled)
        setSelectedResourceIds((data ?? []).map((r) => r.resource_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function toggleResource(id: string) {
    setSelectedResourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function loadData() {
    setLoading(true);

    // Încărcăm TOATE mesajele active (sistem + personale), filtrarea pe
    // acțiune o facem client-side ca să putem comuta „Vezi toate".
    const msgAction = messageActionFor(action);
    const { data: tpl } = await supabase
      .from("followup_templates")
      .select("id, subject, body_html, title, trigger_action, active, user_id")
      .or(`user_id.eq.${user!.id},user_id.is.null`)
      .eq("active", true)
      .not("trigger_action", "is", null)
      .order("user_id", { nullsFirst: true }); // mesajele de sistem primele

    setTemplates(tpl || []);
    // Selectăm implicit primul mesaj recomandat pentru acțiunea curentă.
    const recommended = (tpl || []).filter(
      (t) => t.trigger_action === msgAction,
    );
    if (recommended.length > 0) {
      setSelectedId(recommended[0].id);
    } else if (tpl && tpl.length > 0) {
      // Nu există mesaje pentru acțiune, dar există altele → arătăm toate.
      setShowAll(true);
      setSelectedId(tpl[0].id);
    } else {
      setTab("custom");
    }

    const { data: offer } = await supabase
      .from("offers")
      .select("products_json, total_display, currency, exchange_rate, sent_at")
      .eq("contact_id", contact.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (offer) setLastOffer(offer as LastOffer);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, contact_email, email_signature")
      .eq("id", user!.id)
      .single();

    if (profile) {
      setUserName(profile.full_name || user?.email?.split("@")[0] || "");
      setUserPhone(profile.phone || "");
      setUserEmail(profile.contact_email || user?.email || "");
      setUserSignature(profile.email_signature || "");
    }

    // Pre-completează subiectul custom
    const nume = contact.name || (contact.email ?? "").split("@")[0];
    setCustomSubject(`Salut, ${nume}!`);

    setLoading(false);
  }

  async function send() {
    setSending(true);
    setError("");

    let templateId: string | null = null;
    let createdLinkIds: string[] = [];

    // Validări înainte de orice efect (link-uri etc.)
    if (tab === "template" && (!selected || !selectedBody)) {
      setError("Selectează un template.");
      setSending(false);
      return;
    }
    if (tab === "custom" && !customMessage.trim()) {
      setError("Scrie un mesaj.");
      setSending(false);
      return;
    }

    try {
      let subject: string;
      let html: string;

      if (tab === "template") {
        subject = replaceVars(selected!.subject, vars);
        // Linkuri securizate pentru resursele atașate (doar la template)
        const created = await createResourceLinks(
          user!.id,
          selectedResourceIds,
          contact.id,
        );
        createdLinkIds = created.map((l) => l.id);
        const resourceLinks = created.map((l) => ({
          title: l.title,
          url: l.url,
        }));
        html = buildEmailHtml(
          selectedBody!,
          vars,
          lastOffer,
          userName,
          userSignature,
          resourceLinks,
          userPhone,
          userEmail,
        );
        templateId = selected!.id;
      } else {
        subject = customSubject.trim() || `Salut, ${contact.name || ""}!`;
        html = buildCustomHtml(
          customMessage,
          userName,
          userSignature,
          userPhone,
          userEmail,
        );
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "send-email",
        {
          body: {
            to: contact.email,
            subject,
            html,
            contact_id: contact.id,
            from_name: userName,
            reply_to: userEmail || undefined,
          },
        },
      );

      if (fnError || data?.error) {
        // Curățăm linkurile create (fără orfani) + loghează eroarea
        if (createdLinkIds.length > 0) {
          await supabase
            .from("resource_links")
            .delete()
            .in("id", createdLinkIds);
        }
        await supabase.from("followup_log").insert({
          user_id: user!.id,
          contact_id: contact.id,
          template_id: templateId || null,
          sent_at: new Date().toISOString(),
          status: "failed",
        });
        throw new Error(fnError?.message || data?.error);
      }

      await supabase.from("followup_log").insert({
        user_id: user!.id,
        contact_id: contact.id,
        template_id: templateId || null,
        sent_at: new Date().toISOString(),
        status: "sent",
      });

      const newCount = (contact.followup_count || 0) + 1;
      await supabase
        .from("contacts")
        .update({
          followup_count: newCount,
          status:
            contact.status === "prospect" || contact.status === "in_followup"
              ? "in_followup"
              : contact.status,
        })
        .eq("id", contact.id);

      setSent(true);
      onSent(contact.id);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la trimitere");
    } finally {
      setSending(false);
    }
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "9px",
    background: active ? C.card : "transparent",
    border: "none",
    borderBottom: `2px solid ${active ? C.primary : "transparent"}`,
    color: active ? C.dark : C.muted,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px",
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.border}`,
    borderRadius: "9px",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
    color: C.dark,
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 11000,
        background: "rgba(61,53,48,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.card,
          borderRadius: "20px",
          padding: "24px",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(61,53,48,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "18px", fontWeight: 500, color: C.dark }}>
              Trimite email
            </div>
            <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
              către {contact.name || contact.email}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              fontSize: "20px",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── ACȚIUNE RECOMANDATĂ ── */}
        {ACTION_LABEL[messageActionFor(action)] && (
          <div
            style={{
              background: C.sageLight,
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "15px" }}>💡</span>
            <span style={{ fontSize: "12px", color: C.text2 }}>
              Acțiune recomandată:{" "}
              <strong style={{ color: C.primaryDark }}>
                {ACTION_LABEL[messageActionFor(action)]}
              </strong>
            </span>
          </div>
        )}

        {/* ── COMMUNICATION CONTROLS WARNINGS ── */}
        {contact.communication_blocked && (
          <div style={{
            background: "#FFF0F4", border: "1px solid #F4C0CC", borderRadius: "10px",
            padding: "12px 14px", marginBottom: "16px",
            display: "flex", alignItems: "center", gap: "8px",
            fontSize: "13px", color: C.red,
          }}>
            <span style={{ fontSize: "16px" }}>🚫</span>
            <span><strong>Comunicare blocată.</strong> Nu se poate trimite niciun mesaj acestui contact.</span>
          </div>
        )}
        {!contact.communication_blocked && contact.email_opt_out && (
          <div style={{
            background: "#FFF8EC", border: "1px solid #F0D080", borderRadius: "10px",
            padding: "12px 14px", marginBottom: "16px",
            display: "flex", alignItems: "center", gap: "8px",
            fontSize: "13px", color: "#7A5A00",
          }}>
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <span><strong>Email dezactivat.</strong> Contactul a optat să nu primească emailuri. Poți contacta pe WhatsApp.</span>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "40px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                border: `3px solid ${C.sageLight}`,
                borderTopColor: C.primary,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: `1px solid ${C.border}`,
                marginBottom: "16px",
              }}
            >
              <button
                style={tabBtn(tab === "template")}
                onClick={() => setTab("template")}
              >
                Mesaje recomandate
              </button>
              <button
                style={tabBtn(tab === "custom")}
                onClick={() => setTab("custom")}
              >
                Mesaj custom
              </button>
            </div>

            {/* TAB TEMPLATE */}
            {tab === "template" && (
              <>
                {visibleTemplates.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      background: C.bg2,
                      borderRadius: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        color: C.dark,
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Niciun mesaj pentru această acțiune
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted }}>
                      {templates.length > 0
                        ? "Vezi toate mesajele tale sau folosește „Mesaj custom”."
                        : "Folosește tab-ul „Mesaj custom” sau adaugă un mesaj din pagina Mesaje."}
                    </div>
                    {templates.length > 0 && !showAll && (
                      <button
                        onClick={() => setShowAll(true)}
                        style={{
                          marginTop: "12px",
                          padding: "8px 16px",
                          background: C.primary,
                          border: "none",
                          borderRadius: "8px",
                          color: "white",
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Vezi toate mesajele
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <label style={{ ...labelStyle, marginBottom: 0 }}>
                        {showAll ? "Toate mesajele" : "Mesaje recomandate"}
                      </label>
                      <button
                        onClick={() => setShowAll((s) => !s)}
                        style={{
                          background: "none",
                          border: "none",
                          color: C.primary,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {showAll ? "Doar recomandate" : "Vezi toate →"}
                      </button>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      {visibleTemplates.map((t) => {
                        const body = parseBody(t.body_html);
                        const isSelected = selectedId === t.id;
                        const isSystem = t.user_id === null;
                        const cardTitle = t.title || t.subject;
                        return (
                          <div
                            key={t.id}
                            onClick={() => setSelectedId(t.id)}
                            style={{
                              padding: "12px 14px",
                              borderRadius: "10px",
                              cursor: "pointer",
                              border: `2px solid ${isSelected ? C.primary : C.border}`,
                              background: isSelected ? C.sageLight : C.card,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  border: `2px solid ${isSelected ? C.primary : C.border2}`,
                                  background: isSelected
                                    ? C.primary
                                    : "transparent",
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {isSelected && (
                                  <div
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      background: "white",
                                    }}
                                  />
                                )}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: C.dark,
                                  }}
                                >
                                  {cardTitle}
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      fontSize: "10px",
                                      background: isSystem
                                        ? C.sageLight
                                        : "#EDE8E0",
                                      color: isSystem ? C.primary : C.text2,
                                      padding: "1px 7px",
                                      borderRadius: "999px",
                                    }}
                                  >
                                    {isSystem ? "Sistem" : "Al meu"}
                                  </span>
                                  {showAll &&
                                    t.trigger_action &&
                                    ACTION_LABEL[t.trigger_action] && (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "10px",
                                          background: C.bg2,
                                          color: C.text2,
                                          padding: "1px 7px",
                                          borderRadius: "999px",
                                          fontWeight: 400,
                                        }}
                                      >
                                        {ACTION_LABEL[t.trigger_action]}
                                      </span>
                                    )}
                                </div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: C.muted,
                                    marginTop: "2px",
                                  }}
                                >
                                  „{body.headline}"
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── RESURSE ATAȘATE ── */}
                    {selected && (
                      <div style={{ marginBottom: "12px" }}>
                        <button
                          onClick={() => setShowResourcePicker((s) => !s)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 12px",
                            background: C.bg2,
                            border: `1.5px dashed ${C.border2}`,
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 500,
                            color: C.text2,
                            cursor: "pointer",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          <i className="ti ti-paperclip" style={{ fontSize: "14px" }} />
                          Atașează materiale
                          {selectedResourceIds.length > 0 &&
                            ` (${selectedResourceIds.length})`}
                        </button>

                        {showResourcePicker && (
                          <div
                            style={{
                              marginTop: "8px",
                              background: C.card,
                              border: `1px solid ${C.border2}`,
                              borderRadius: "10px",
                              padding: "10px",
                              maxHeight: "200px",
                              overflowY: "auto",
                            }}
                          >
                            {resources.length === 0 ? (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: C.muted,
                                  textAlign: "center",
                                  padding: "12px",
                                }}
                              >
                                Nu ai resurse încă. Adaugă-le din pagina „Resurse".
                              </div>
                            ) : (
                              resources.map((r) => {
                                const checked = selectedResourceIds.includes(r.id);
                                return (
                                  <label
                                    key={r.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      padding: "7px 4px",
                                      cursor: "pointer",
                                      borderBottom: `1px solid ${C.border}`,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleResource(r.id)}
                                      style={{
                                        accentColor: C.primary,
                                        width: "15px",
                                        height: "15px",
                                        cursor: "pointer",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <i
                                      className={
                                        r.file_type === "application/pdf"
                                          ? "ti ti-file-type-pdf"
                                          : "ti ti-photo"
                                      }
                                      style={{
                                        fontSize: "15px",
                                        color: C.primary,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        color: C.dark,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {r.title}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}

                        {selectedResourceIds.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "6px",
                              marginTop: "8px",
                            }}
                          >
                            {selectedResourceIds.map((id) => {
                              const r = resources.find((x) => x.id === id);
                              if (!r) return null;
                              return (
                                <div
                                  key={id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "5px 8px",
                                    background: C.sageLight,
                                    border: `1px solid ${C.border2}`,
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    color: C.dark,
                                  }}
                                >
                                  <i
                                    className="ti ti-paperclip"
                                    style={{ fontSize: "12px", color: C.primary }}
                                  />
                                  {r.title}
                                  <button
                                    onClick={() => toggleResource(id)}
                                    aria-label="Scoate"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: C.muted,
                                      fontSize: "13px",
                                      padding: 0,
                                      lineHeight: 1,
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {selected && (
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        style={{
                          width: "100%",
                          padding: "9px",
                          background: C.bg2,
                          border: `1px solid ${C.border}`,
                          borderRadius: "9px",
                          color: C.dark,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: "13px",
                          cursor: "pointer",
                          marginBottom: "12px",
                        }}
                      >
                        {showPreview
                          ? "▲ Ascunde preview"
                          : "👁 Previzualizează emailul"}
                      </button>
                    )}

                    {showPreview && selected && selectedBody && (
                      <div
                        style={{
                          border: `1px solid ${C.border}`,
                          borderRadius: "10px",
                          overflow: "hidden",
                          marginBottom: "12px",
                        }}
                      >
                        <iframe
                          srcDoc={buildEmailHtml(
                            selectedBody,
                            vars,
                            lastOffer,
                            userName,
                            userSignature,
                            selectedResourceIds
                              .map((id) => resources.find((r) => r.id === id))
                              .filter((r): r is NonNullable<typeof r> =>
                                Boolean(r),
                              )
                              .map((r) => ({ title: r.title, url: "#" })),
                            userPhone,
                            userEmail,
                          )}
                          style={{
                            width: "100%",
                            height: "480px",
                            border: "none",
                          }}
                          title="preview"
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* TAB CUSTOM */}
            {tab === "custom" && (
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Subiect</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "12px" }}
                  placeholder="Subiectul emailului"
                />
                <label style={labelStyle}>Mesaj</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={7}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  placeholder={`Bună ${contact.name?.split(" ")[0] || ""}!\n\nScrie aici mesajul tău...`}
                />
                <div
                  style={{ fontSize: "11px", color: C.muted, marginTop: "6px" }}
                >
                  Mesajul va fi trimis cu antetul AromaTool și semnătura ta.
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: C.redbg,
                  border: "1px solid rgba(201,79,106,0.2)",
                  borderRadius: "9px",
                  fontSize: "13px",
                  color: C.red,
                  marginBottom: "12px",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {sent ? (
              <div
                style={{
                  padding: "14px",
                  background: C.greenbg,
                  border: "1px solid rgba(46,138,88,0.2)",
                  borderRadius: "10px",
                  textAlign: "center",
                  fontSize: "14px",
                  color: C.green,
                  fontWeight: 500,
                }}
              >
                ✓ Email trimis cu succes!
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: C.bg2,
                    border: `1px solid ${C.border}`,
                    borderRadius: "10px",
                    color: C.dark,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Anulează
                </button>
                <button
                  onClick={send}
                  disabled={
                    sending ||
                    !!contact.communication_blocked ||
                    !!contact.email_opt_out ||
                    (tab === "template" && !selectedId) ||
                    (tab === "custom" && !customMessage.trim())
                  }
                  style={{
                    flex: 2,
                    padding: "11px",
                    background:
                      sending ||
                      contact.communication_blocked ||
                      contact.email_opt_out ||
                      (tab === "template" && !selectedId) ||
                      (tab === "custom" && !customMessage.trim())
                        ? C.muted
                        : C.primary,
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor:
                      sending ||
                      contact.communication_blocked ||
                      contact.email_opt_out ||
                      (tab === "template" && !selectedId) ||
                      (tab === "custom" && !customMessage.trim())
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {sending
                    ? "Se trimite..."
                    : contact.communication_blocked
                    ? "Comunicare blocată"
                    : contact.email_opt_out
                    ? "Email dezactivat"
                    : `Trimite către ${contact.name?.split(" ")[0] || (contact.email ?? "").split("@")[0]}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: "#6A5A50",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};
