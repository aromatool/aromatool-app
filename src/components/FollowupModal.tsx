import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

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
  trigger_day: number;
  active: boolean;
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
  phone: string | null;
  status?: string;
  followup_count?: number;
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

function buildEmailHtml(
  body: TemplateBody,
  vars: Record<string, string>,
  lastOffer: LastOffer | null,
  userName: string,
): string {
  const headline = replaceVars(body.headline, vars);
  const intro = replaceVars(body.intro, vars);

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
  <div style="background:#5C7A5C;padding:24px;text-align:center;">
    <div style="color:white;font-size:22px;margin-bottom:4px">AromaTool</div>
    <div style="color:#E8F0E8;font-size:10px;letter-spacing:2px;font-style:italic">crafted for your team</div>
  </div>
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
    <div style="text-align:center;margin-bottom:20px;">
      <a href="mailto:${vars["{{email}}"]}" style="display:inline-block;background:#5C7A5C;border-radius:10px;padding:12px 32px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">${body.cta} →</a>
    </div>
    <p style="font-size:12px;color:#A89888;text-align:center;margin:0">${body.closing}, <strong style="color:#4A6A4A">${userName}</strong></p>
  </div>
  <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
    <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
  </div>
</div></body></html>`;
}

// Email custom — layout simplu, mesaj liber
function buildCustomHtml(message: string, userName: string): string {
  const safe = message.replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#FAFAF7;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8E0;">
  <div style="background:#5C7A5C;padding:24px;text-align:center;">
    <div style="color:white;font-size:22px;margin-bottom:4px">AromaTool</div>
    <div style="color:#E8F0E8;font-size:10px;letter-spacing:2px;font-style:italic">crafted for your team</div>
  </div>
  <div style="padding:28px;">
    <p style="font-size:14px;color:#3D3530;line-height:1.8;margin:0 0 20px;white-space:pre-wrap">${safe}</p>
    <p style="font-size:12px;color:#A89888;margin:0">Cu drag, <strong style="color:#4A6A4A">${userName}</strong></p>
  </div>
  <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
    <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
  </div>
</div></body></html>`;
}

interface FollowupModalProps {
  contact: Contact;
  onClose: () => void;
  onSent: (contactId: string) => void;
}

type Tab = "template" | "custom";

export default function FollowupModal({
  contact,
  onClose,
  onSent,
}: FollowupModalProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastOffer, setLastOffer] = useState<LastOffer | null>(null);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
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

  async function loadData() {
    setLoading(true);

    // Template-uri — încarcă pentru statusul contactului (fallback prospect)
    const triggerStatus =
      contact.status === "client_nou" || contact.status === "client_fidel"
        ? "client_nou"
        : "prospect";

    const { data: tpl } = await supabase
      .from("followup_templates")
      .select("id, subject, body_html, trigger_day, active")
      .eq("user_id", user!.id)
      .eq("trigger_status", triggerStatus)
      .eq("active", true)
      .order("trigger_day");

    setTemplates(tpl || []);
    if (tpl && tpl.length > 0) {
      const idx = Math.min(contact.followup_count || 0, tpl.length - 1);
      setSelectedId(tpl[idx].id);
    } else {
      // Niciun template → deschide direct pe custom
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
      .select("full_name, phone, contact_email")
      .eq("id", user!.id)
      .single();

    if (profile) {
      setUserName(profile.full_name || user?.email?.split("@")[0] || "");
      setUserPhone(profile.phone || "");
    }

    // Pre-completează subiectul custom
    const nume = contact.name || (contact.email ?? "").split("@")[0];
    setCustomSubject(`Salut, ${nume}!`);

    setLoading(false);
  }

  async function send() {
    setSending(true);
    setError("");

    let subject: string;
    let html: string;
    let templateId: string | null = null;

    if (tab === "template") {
      if (!selected || !selectedBody) {
        setError("Selectează un template.");
        setSending(false);
        return;
      }
      subject = replaceVars(selected.subject, vars);
      html = buildEmailHtml(selectedBody, vars, lastOffer, userName);
      templateId = selected.id;
    } else {
      if (!customMessage.trim()) {
        setError("Scrie un mesaj.");
        setSending(false);
        return;
      }
      subject = customSubject.trim() || `Salut, ${contact.name || ""}!`;
      html = buildCustomHtml(customMessage, userName);
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-email",
        {
          body: { to: contact.email, subject, html },
        },
      );

      if (fnError || data?.error)
        throw new Error(fnError?.message || data?.error);

      await supabase.from("followup_log").insert({
        user_id: user!.id,
        contact_id: contact.id,
        template_id: templateId,
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
                Din template
              </button>
              <button
                style={tabBtn(tab === "custom")}
                onClick={() => setTab("custom")}
              >
                Email custom
              </button>
            </div>

            {/* TAB TEMPLATE */}
            {tab === "template" && (
              <>
                {templates.length === 0 ? (
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
                      Niciun template activ
                    </div>
                    <div style={{ fontSize: "12px", color: C.muted }}>
                      Folosește tab-ul „Email custom" sau activează un template
                      din pagina Template-uri.
                    </div>
                  </div>
                ) : (
                  <>
                    <label style={labelStyle}>Selectează template-ul</label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      {templates.map((t, i) => {
                        const body = parseBody(t.body_html);
                        const isSelected = selectedId === t.id;
                        const isRecommended =
                          i ===
                          Math.min(
                            contact.followup_count || 0,
                            templates.length - 1,
                          );
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
                                  {t.subject}
                                  {isRecommended && (
                                    <span
                                      style={{
                                        marginLeft: "8px",
                                        fontSize: "10px",
                                        background: C.primary,
                                        color: "white",
                                        padding: "1px 7px",
                                        borderRadius: "999px",
                                      }}
                                    >
                                      Recomandat
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
                                  Ziua {t.trigger_day} · „{body.headline}"
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

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
                    (tab === "template" && !selectedId) ||
                    (tab === "custom" && !customMessage.trim())
                  }
                  style={{
                    flex: 2,
                    padding: "11px",
                    background:
                      sending ||
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
                      (tab === "template" && !selectedId) ||
                      (tab === "custom" && !customMessage.trim())
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {sending
                    ? "Se trimite..."
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
