import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const C = {
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
  email: string;
  name: string | null;
  phone: string | null;
  followup_count: number;
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
  subject: string,
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
      <td style="padding:10px 16px;border-bottom:1px solid #F0EEFF;font-size:13px;color:#2D1A4E">${p.name}${p.disc > 0 ? ` <span style="color:#C94F6A;font-size:11px">−${p.disc}%</span>` : ""}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #F0EEFF;font-size:13px;color:#9B80C4;text-align:center">×${p.qty}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #F0EEFF;font-size:13px;font-weight:600;color:#4A3270;text-align:right">${total.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${lastOffer.currency || "RON"}</td>
    </tr>`;
      })
      .join("") || "";

  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#F5F0FF;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E0D4F8;">
  <div style="background:#4A3270;padding:24px;text-align:center;">
    <div style="color:white;font-size:22px;margin-bottom:4px">AromaTool</div>
    <div style="color:#C8BFFF;font-size:10px;letter-spacing:2px;font-style:italic">crafted for your team</div>
  </div>
  <div style="padding:28px;">
    <p style="font-size:16px;color:#4A3270;font-weight:600;margin:0 0 14px;text-align:center">${headline}</p>
    <p style="font-size:13px;color:#6B5B9E;line-height:1.8;margin:0 0 20px;white-space:pre-wrap">${intro}</p>

    ${
      lastOffer
        ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;color:#9B80C4;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:8px">📦 Oferta anterioară</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E8E0F8;border-radius:10px;overflow:hidden;">
        <thead><tr style="background:#F5F0FF;">
          <th style="padding:8px 16px;font-size:11px;color:#9B80C4;text-align:left;font-weight:500">Produs</th>
          <th style="padding:8px 16px;font-size:11px;color:#9B80C4;text-align:center;font-weight:500">Cant.</th>
          <th style="padding:8px 16px;font-size:11px;color:#9B80C4;text-align:right;font-weight:500">Total</th>
        </tr></thead>
        <tbody>${productsHtml}</tbody>
      </table>
      <div style="text-align:right;margin-top:8px;font-family:'Helvetica Neue',Arial,sans-serif;">
        <span style="font-size:13px;color:#9B80C4">Total: </span>
        <span style="font-size:18px;font-weight:700;color:#4A3270">${lastOffer.total_display?.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${lastOffer.currency || "RON"}</span>
      </div>
    </div>`
        : ""
    }

    <div style="text-align:center;margin-bottom:20px;">
      <a href="mailto:${vars["{{email}}"]}" style="display:inline-block;background:linear-gradient(135deg,#7B5EA7,#4A3270);border-radius:10px;padding:12px 32px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">${body.cta} →</a>
    </div>
    <p style="font-size:12px;color:#9B80C4;text-align:center;margin:0">${body.closing}, <strong style="color:#4A3270">${userName}</strong></p>
  </div>
  <div style="background:#F9F7FF;border-top:1px solid #F0EEFF;padding:10px;text-align:center;">
    <span style="font-size:10px;color:#C4A8E8">Trimis prin AromaTool</span>
  </div>
</div></body></html>`;
}

interface FollowupModalProps {
  contact: Contact;
  onClose: () => void;
  onSent: (contactId: string) => void;
}

export default function FollowupModal({
  contact,
  onClose,
  onSent,
}: FollowupModalProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastOffer, setLastOffer] = useState<LastOffer | null>(null);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");

  const selected = templates.find((t) => t.id === selectedId);
  const selectedBody = selected ? parseBody(selected.body_html) : null;

  const vars: Record<string, string> = {
    "{{nume}}": contact.name || contact.email.split("@")[0],
    "{{email}}": contact.email,
    "{{zile}}": lastOffer
      ? String(
          Math.floor(
            (Date.now() - new Date((lastOffer as any).sent_at).getTime()) /
              86400000,
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

    // Load templates
    const { data: tpl } = await supabase
      .from("followup_templates")
      .select("id, subject, body_html, trigger_day, active")
      .eq("user_id", user!.id)
      .eq("trigger_status", "prospect")
      .eq("active", true)
      .order("trigger_day");

    setTemplates(tpl || []);
    if (tpl && tpl.length > 0) {
      // Auto-select template based on followup_count
      const idx = Math.min(contact.followup_count || 0, tpl.length - 1);
      setSelectedId(tpl[idx].id);
    }

    // Load last offer
    const { data: offer } = await supabase
      .from("offers")
      .select("products_json, total_display, currency, exchange_rate, sent_at")
      .eq("contact_id", contact.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();

    if (offer) setLastOffer(offer as any);

    // Load profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, contact_email")
      .eq("id", user!.id)
      .single();

    if (profile) {
      setUserName(profile.full_name || user?.email?.split("@")[0] || "");
      setUserPhone(profile.phone || "");
      setUserEmail(profile.contact_email || user?.email || "");
    }

    setLoading(false);
  }

  async function send() {
    if (!selected || !selectedBody) return;
    setSending(true);
    setError("");

    const subject = replaceVars(selected.subject, vars);
    const html = buildEmailHtml(
      selectedBody,
      subject,
      vars,
      lastOffer,
      userName,
    );

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "send-email",
        {
          body: { to: contact.email, subject, html },
        },
      );

      if (fnError || data?.error)
        throw new Error(fnError?.message || data?.error);

      // Log follow-up
      await supabase.from("followup_log").insert({
        user_id: user!.id,
        contact_id: contact.id,
        template_id: selected.id,
        sent_at: new Date().toISOString(),
        status: "sent",
      });

      // Update contact
      const newCount = (contact.followup_count || 0) + 1;
      await supabase
        .from("contacts")
        .update({
          followup_count: newCount,
          status: newCount >= 1 ? "in_followup" : "prospect",
        })
        .eq("id", contact.id);

      setSent(true);
      onSent(contact.id);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || "Eroare la trimitere");
    } finally {
      setSending(false);
    }
  }

  return (
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
          boxShadow: "0 20px 60px rgba(45,26,78,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "18px",
                color: C.dark,
              }}
            >
              Trimite Follow-up
            </div>
            <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
              către {contact.name || contact.email}
            </div>
          </div>
          <button
            onClick={onClose}
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
                border: "3px solid #E8E0F8",
                borderTopColor: C.primary,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        ) : templates.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px",
              background: C.bg2,
              borderRadius: "12px",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📝</div>
            <div
              style={{
                fontSize: "13px",
                color: C.dark,
                fontWeight: 500,
                marginBottom: "4px",
              }}
            >
              Nu ai template-uri active
            </div>
            <div style={{ fontSize: "12px", color: C.muted }}>
              Mergi la pagina Template-uri și activează cel puțin unul
            </div>
          </div>
        ) : (
          <>
            {/* Template selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Selectează template-ul</label>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {templates.map((t, i) => {
                  const body = parseBody(t.body_html);
                  const isSelected = selectedId === t.id;
                  const isRecommended =
                    i ===
                    Math.min(contact.followup_count || 0, templates.length - 1);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        border: `2px solid ${isSelected ? C.primary : C.border2}`,
                        background: isSelected ? C.bg2 : C.card,
                        transition: "all 0.15s",
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
                            background: isSelected ? C.primary : "transparent",
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
                            ⏰ Template #{i + 1} · "{body.headline}"
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview toggle */}
            {selected && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  width: "100%",
                  padding: "9px",
                  background: C.bg2,
                  border: `1px solid ${C.border2}`,
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
                  border: `1px solid ${C.border2}`,
                  borderRadius: "10px",
                  overflow: "hidden",
                  marginBottom: "12px",
                }}
              >
                <iframe
                  srcDoc={buildEmailHtml(
                    selectedBody,
                    selected.subject,
                    vars,
                    lastOffer,
                    userName,
                  )}
                  style={{ width: "100%", height: "480px", border: "none" }}
                  title="preview"
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: C.redbg,
                  border: `1px solid rgba(201,79,106,0.2)`,
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
                  border: `1px solid rgba(46,138,88,0.2)`,
                  borderRadius: "10px",
                  textAlign: "center",
                  fontSize: "14px",
                  color: C.green,
                  fontWeight: 500,
                }}
              >
                ✅ Follow-up trimis cu succes!
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={onClose}
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
                  Anulează
                </button>
                <button
                  onClick={send}
                  disabled={sending || !selectedId}
                  style={{
                    flex: 2,
                    padding: "11px",
                    background:
                      sending || !selectedId
                        ? C.muted
                        : `linear-gradient(135deg, ${C.primary}, #4A3270)`,
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: sending || !selectedId ? "not-allowed" : "pointer",
                  }}
                >
                  {sending
                    ? "Se trimite..."
                    : `📧 Trimite follow-up către ${contact.name || contact.email.split("@")[0]}`}
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
  color: "#6B5B9E",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};
