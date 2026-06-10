import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { EMAIL_HEADER_HTML } from "../lib/emailLogo";
import { buildEmailFooter } from "../lib/emailFooter";
import { useResources } from "../hooks/useResources";

// ── BLOSSOM SAGE ───────────────────────────────────────────
const C = {
  card: "#FFFFFF",
  bg: "#FAFAF7",
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

// Variabilele inserabile — eticheta descriptivă vine din i18n (templates.variables.<id>).
const VARIABLES = [
  { key: "{{nume}}", id: "nume" },
  { key: "{{zile}}", id: "zile" },
  { key: "{{produse}}", id: "produse" },
  { key: "{{total}}", id: "total" },
  { key: "{{distribuitor}}", id: "distribuitor" },
  { key: "{{telefon}}", id: "telefon" },
];

// Tab-uri pe ACȚIUNE (legate de Recommended Action), nu pe status/zile.
// Label/desc vin din i18n (templates.tabs.<key>.label / .desc).
const TABS = [
  { key: "needs_offer" },
  { key: "needs_followup" },
  { key: "reactivate" },
  { key: "discuss_business" },
];

interface Template {
  id: string;
  subject: string;
  body_html: string;
  title: string | null;
  trigger_action: string | null;
  active: boolean;
  user_id: string | null; // null = mesaj de sistem (global)
  system_key: string | null;
}

interface TemplateBody {
  type: string;
  headline: string;
  intro: string;
  cta: string;
  closing: string;
}

function parseBody(body_html: string): TemplateBody {
  try {
    return JSON.parse(body_html);
  } catch {
    return { type: "", headline: "", intro: "", cta: "Scrie-mi", closing: "Cu drag" };
  }
}

function buildPreviewHtml(
  body: TemplateBody,
  subject: string,
  userName = "Distribuitorul tău",
  userPhone?: string,
  userEmail?: string,
  userSignature?: string,
): string {
  const sub = (t: string) =>
    t
      .replace(/{{nume}}/g, "<strong>Maria</strong>")
      .replace(/{{zile}}/g, "<strong>5</strong>")
      .replace(/{{distribuitor}}/g, `<strong>${userName}</strong>`)
      .replace(/{{telefon}}/g, "<strong>0712 345 678</strong>");
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#FAFAF7;font-family:Georgia,serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8E0;">
      ${EMAIL_HEADER_HTML}
      <div style="padding:26px 24px;">
        <p style="font-size:12px;color:#A89888;margin-bottom:6px;text-align:center">Subiect: <strong style="color:#4A6A4A">${sub(subject) || "..."}</strong></p>
        <p style="font-size:16px;color:#4A6A4A;font-weight:600;margin:14px 0 12px;text-align:center">${sub(body.headline) || "..."}</p>
        <p style="font-size:13px;color:#6A5A50;line-height:1.8;margin-bottom:18px;white-space:pre-wrap">${sub(body.intro) || "..."}</p>
        <div style="background:#F5EEE8;border-radius:10px;padding:12px 16px;margin-bottom:18px;">
          <div style="font-size:11px;color:#A89888;margin-bottom:6px">📦 Exemplu ofertă anterioară:</div>
          <div style="font-size:12px;color:#3D3530">• Lavender 15ml ×2<br>• Peppermint 15ml ×1</div>
          <div style="font-size:12px;color:#4A6A4A;font-weight:600;margin-top:6px">Total: 245,00 RON</div>
        </div>
      </div>
      ${buildEmailFooter({ userName, userPhone, userEmail, userSignature })}
      <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
        <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
      </div>
    </div>
  </body></html>`;
}

// ── CARD MESAJ DE SISTEM (read-only) ───────────────────────
function SystemMessageCard({
  template,
  userName,
  onPersonalize,
}: {
  template: Template;
  userName: string;
  onPersonalize: (t: Template) => void;
}) {
  const { t: tr } = useTranslation();
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};
  const body = parseBody(template.body_html);
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        marginBottom: "10px",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: C.dark }}>
              {template.title || template.subject}
            </span>
            <span
              style={{
                fontSize: "10px",
                background: C.sageLight,
                color: C.primary,
                padding: "1px 8px",
                borderRadius: "999px",
                fontWeight: 600,
              }}
            >
              {tr("templates.system")}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>
            „{body.headline}"
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button onClick={() => setShowPreview(!showPreview)} style={ghostBtn}>
            {showPreview ? tr("templates.hide") : "👁"}
          </button>
          <button
            onClick={() => onPersonalize(template)}
            style={{ ...ghostBtn, color: C.primary, borderColor: C.border2 }}
          >
            {tr("templates.personalize")}
          </button>
        </div>
      </div>
      {showPreview && (
        <div
          style={{
            marginTop: "12px",
            border: `1px solid ${C.border}`,
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <iframe
            srcDoc={buildPreviewHtml(
              body,
              template.subject,
              userName,
              meta.phone,
              meta.contact_email || user?.email,
              meta.email_signature,
            )}
            style={{ width: "100%", height: "460px", border: "none" }}
            title="preview"
          />
        </div>
      )}
    </div>
  );
}

// ── EDITOR MESAJ PERSONAL ──────────────────────────────────
function TemplateEditor({
  template,
  onSave,
  onToggle,
  onDelete,
  userName,
}: {
  template: Template;
  onSave: (id: string, data: Partial<Template>) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  userName: string;
}) {
  const { t: tr } = useTranslation();
  const { user } = useAuth();
  const { resources } = useResources();
  const body = parseBody(template.body_html);
  const [editBody, setEditBody] = useState<TemplateBody>(body);
  const [title, setTitle] = useState(template.title || "");
  const [subject, setSubject] = useState(template.subject);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Resurse implicite atașate acestui mesaj (template_resources)
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [showResPicker, setShowResPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("template_resources")
        .select("resource_id")
        .eq("template_id", template.id);
      if (!cancelled)
        setAttachedIds((data ?? []).map((r) => r.resource_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  async function toggleAttach(resId: string) {
    if (attachedIds.includes(resId)) {
      setAttachedIds((prev) => prev.filter((x) => x !== resId));
      await supabase
        .from("template_resources")
        .delete()
        .eq("template_id", template.id)
        .eq("resource_id", resId);
    } else {
      setAttachedIds((prev) => [...prev, resId]);
      await supabase.from("template_resources").insert({
        template_id: template.id,
        resource_id: resId,
        user_id: user!.id,
      });
    }
  }

  async function save() {
    setSaving(true);
    await onSave(template.id, {
      title: title || subject,
      subject,
      body_html: JSON.stringify(editBody),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border2}`,
        borderRadius: "12px",
        marginBottom: "10px",
        opacity: template.active ? 1 : 0.55,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          cursor: "pointer",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.dark }}>
            {template.title || template.subject}
          </span>
          <span
            style={{
              fontSize: "10px",
              background: "#EDE8E0",
              color: C.text2,
              padding: "1px 8px",
              borderRadius: "999px",
              fontWeight: 600,
            }}
          >
            {tr("templates.mine")}
          </span>
        </div>
        <div
          style={{ display: "flex", gap: "6px", alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggle(template.id, template.active)}
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 500,
              background: template.active ? C.greenbg : "#F5F5F5",
              border: `1px solid ${template.active ? C.green : "#DDD"}`,
              borderRadius: "999px",
              color: template.active ? C.green : "#999",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {template.active ? tr("templates.active") : tr("templates.inactive")}
          </button>
          <button
            onClick={() => onDelete(template.id)}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              background: C.redbg,
              border: `1px solid rgba(201,79,106,0.2)`,
              borderRadius: "8px",
              color: C.red,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
            title={tr("templates.deleteTitle")}
          >
            🗑
          </button>
          <span style={{ fontSize: "12px", color: C.muted }}>
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Editor */}
      {isOpen && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ marginTop: "14px" }}>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>{tr("templates.nameLabel")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr("templates.namePlaceholderEdit")}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>{tr("templates.subjectLabel")}</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={tr("templates.subjectPlaceholder")}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>{tr("templates.headlineLabel")}</label>
              <input
                value={editBody.headline}
                onChange={(e) =>
                  setEditBody((p) => ({ ...p, headline: e.target.value }))
                }
                placeholder={tr("templates.headlinePlaceholderEdit")}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>{tr("templates.bodyLabel")}</label>
              <textarea
                value={editBody.intro}
                rows={4}
                onChange={(e) =>
                  setEditBody((p) => ({ ...p, intro: e.target.value }))
                }
                placeholder={tr("templates.bodyPlaceholderEdit")}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            {/* ── MATERIALE IMPLICITE ── */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>{tr("templates.attachLabel")}</label>
              <div
                style={{
                  fontSize: "11px",
                  color: C.muted,
                  marginBottom: "8px",
                  lineHeight: 1.5,
                }}
              >
                {tr("templates.attachHint")}
              </div>
              <button
                onClick={() => setShowResPicker((s) => !s)}
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
                {tr("templates.chooseMaterials")}
                {attachedIds.length > 0 && ` (${attachedIds.length})`}
              </button>

              {showResPicker && (
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
                      {tr("templates.noResources")}
                    </div>
                  ) : (
                    resources.map((r) => {
                      const checked = attachedIds.includes(r.id);
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
                            onChange={() => toggleAttach(r.id)}
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

              {attachedIds.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginTop: "8px",
                  }}
                >
                  {attachedIds.map((id) => {
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
                          onClick={() => toggleAttach(id)}
                          aria-label={tr("templates.removeAria")}
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

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: saved ? C.greenbg : C.primary,
                  border: saved ? `1px solid ${C.green}` : "none",
                  borderRadius: "9px",
                  color: saved ? C.green : "white",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {saving ? tr("templates.saving") : saved ? tr("templates.saved") : tr("templates.saveMessage")}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                style={{
                  padding: "10px 14px",
                  background: C.bg2,
                  border: `1px solid ${C.border}`,
                  borderRadius: "9px",
                  color: C.dark,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {showPreview ? tr("templates.hide") : tr("templates.preview")}
              </button>
            </div>

            {showPreview && (
              <div
                style={{
                  marginTop: "14px",
                  border: `1px solid ${C.border2}`,
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <iframe
                  srcDoc={buildPreviewHtml(
                    editBody,
                    subject,
                    userName,
                    user?.user_metadata?.phone,
                    user?.user_metadata?.contact_email || user?.email,
                    user?.user_metadata?.email_signature,
                  )}
                  style={{ width: "100%", height: "480px", border: "none" }}
                  title="preview"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { t: tr } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("needs_offer");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(tr("templates.defaultUserName"));
  const [showNewForm, setShowNewForm] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const emptyNew = {
    title: "",
    subject: "",
    headline: "",
    intro: "",
    cta: "Scrie-mi",
    closing: "Cu drag",
  };
  const [newTemplate, setNewTemplate] = useState(emptyNew);

  useEffect(() => {
    if (user) {
      loadTemplates();
      loadUserName();
    }
  }, [user]);

  async function loadUserName() {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user!.id)
      .single();
    if (data?.full_name) setUserName(data.full_name);
  }

  async function loadTemplates() {
    setLoading(true);
    // Mesaje de sistem (globale) + personale, doar cele legate de o acțiune.
    const { data } = await supabase
      .from("followup_templates")
      .select(
        "id, subject, body_html, title, trigger_action, active, user_id, system_key",
      )
      .or(`user_id.eq.${user!.id},user_id.is.null`)
      .not("trigger_action", "is", null)
      .order("user_id", { nullsFirst: true });
    setTemplates(data || []);
    setLoading(false);
  }

  async function addTemplate() {
    if (!newTemplate.subject || !newTemplate.headline) return;
    setAddingSaving(true);
    const body = {
      type: `custom_${Date.now()}`,
      headline: newTemplate.headline,
      intro: newTemplate.intro,
      cta: newTemplate.cta,
      closing: newTemplate.closing,
    };
    const { data } = await supabase
      .from("followup_templates")
      .insert({
        user_id: user!.id,
        trigger_action: activeTab,
        trigger_status: activeTab === "discuss_business" ? "client_nou" : "prospect",
        trigger_day: 0,
        subject: newTemplate.subject,
        title: newTemplate.title || newTemplate.subject,
        body_html: JSON.stringify(body),
        language_code: "ro",
        plan_required: "starter",
        active: true,
      })
      .select(
        "id, subject, body_html, title, trigger_action, active, user_id, system_key",
      )
      .single();
    if (data) setTemplates((prev) => [...prev, data]);
    setNewTemplate(emptyNew);
    setShowNewForm(false);
    setAddingSaving(false);
  }

  function personalize(t: Template) {
    const body = parseBody(t.body_html);
    setNewTemplate({
      title: `${t.title || t.subject} (${tr("templates.personalizedSuffix")})`,
      subject: t.subject,
      headline: body.headline,
      intro: body.intro,
      cta: body.cta || "Scrie-mi",
      closing: body.closing || "Cu drag",
    });
    setShowNewForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(id: string, updates: Partial<Template>) {
    await supabase.from("followup_templates").update(updates).eq("id", id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  }

  async function handleToggle(id: string, active: boolean) {
    await supabase
      .from("followup_templates")
      .update({ active: !active })
      .eq("id", id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !active } : t)),
    );
  }

  async function handleDelete(id: string) {
    if (!confirm(tr("templates.deleteConfirm"))) return;
    await supabase.from("followup_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const tabTemplates = templates.filter((t) => t.trigger_action === activeTab);
  const systemMsgs = tabTemplates.filter((t) => t.user_id === null);
  const personalMsgs = tabTemplates.filter((t) => t.user_id !== null);

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            border: `3px solid ${C.sageLight}`,
            borderTopColor: C.primary,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px",
            color: C.dark,
            marginBottom: "6px",
          }}
        >
          {tr("templates.title")}
        </div>
        <div style={{ fontSize: "13px", color: C.muted }}>
          {tr("templates.subtitle")}
        </div>
      </div>

      {/* Variables reference */}
      <div
        style={{
          background: C.bg2,
          borderRadius: "12px",
          padding: "14px 16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: C.primary,
            marginBottom: "8px",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {tr("templates.variablesTitle")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => navigator.clipboard.writeText(v.key)}
              title={tr("templates.variableCopyTitle", { desc: tr(`templates.variables.${v.id}`) })}
              style={{
                padding: "4px 12px",
                background: "white",
                border: `1px solid ${C.border2}`,
                borderRadius: "999px",
                fontSize: "12px",
                color: C.primary,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {v.key}
            </button>
          ))}
        </div>
        <div style={{ fontSize: "10px", color: C.muted }}>
          {tr("templates.variablesHint")}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          background: C.bg2,
          borderRadius: "12px",
          padding: "4px",
          marginBottom: "20px",
          gap: "2px",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowNewForm(false);
            }}
            style={{
              flex: 1,
              padding: "10px 6px",
              border: "none",
              borderRadius: "9px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              fontWeight: activeTab === tab.key ? 600 : 400,
              background: activeTab === tab.key ? "white" : "transparent",
              color: activeTab === tab.key ? C.dark : C.muted,
              boxShadow:
                activeTab === tab.key ? "0 1px 6px rgba(92,122,92,0.12)" : "none",
              transition: "all 0.15s",
              textAlign: "center",
            }}
          >
            {tr(`templates.tabs.${tab.key}.label`)}
          </button>
        ))}
      </div>

      {/* Tab description + add */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "12px", color: C.muted }}>{tr(`templates.tabs.${activeTab}.desc`)}</div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            padding: "7px 14px",
            border: showNewForm ? `1px solid ${C.border2}` : "none",
            borderRadius: "9px",
            background: showNewForm ? C.bg2 : C.primary,
            color: showNewForm ? C.dark : "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showNewForm ? tr("templates.cancel") : tr("templates.newMessage")}
        </button>
      </div>

      {/* New message form */}
      {showNewForm && (
        <div
          style={{
            background: C.card,
            border: `1.5px dashed ${C.primary}`,
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: C.primary,
              marginBottom: "14px",
            }}
          >
            {tr("templates.newFormTitle", { tab: tr(`templates.tabs.${activeTab}.label`) })}
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>{tr("templates.nameLabel")}</label>
            <input
              value={newTemplate.title}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, title: e.target.value }))
              }
              placeholder={tr("templates.namePlaceholderNew")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>{tr("templates.subjectLabel")}</label>
            <input
              value={newTemplate.subject}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, subject: e.target.value }))
              }
              placeholder={tr("templates.subjectPlaceholder")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>{tr("templates.headlineLabel")}</label>
            <input
              value={newTemplate.headline}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, headline: e.target.value }))
              }
              placeholder={tr("templates.headlinePlaceholderNew")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>{tr("templates.bodyLabel")}</label>
            <textarea
              value={newTemplate.intro}
              rows={3}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, intro: e.target.value }))
              }
              placeholder={tr("templates.bodyPlaceholderNew")}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button
            onClick={addTemplate}
            disabled={addingSaving}
            style={{
              width: "100%",
              padding: "10px",
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
            {addingSaving ? tr("templates.saving") : tr("templates.addMessage")}
          </button>
        </div>
      )}

      {/* Personal messages */}
      {personalMsgs.length > 0 && (
        <>
          <div style={sectionLabel}>{tr("templates.myMessages")}</div>
          {personalMsgs.map((t) => (
            <TemplateEditor
              key={t.id}
              template={t}
              onSave={handleSave}
              onToggle={handleToggle}
              onDelete={handleDelete}
              userName={userName}
            />
          ))}
        </>
      )}

      {/* System messages */}
      {systemMsgs.length > 0 && (
        <>
          <div style={sectionLabel}>{tr("templates.systemMessages")}</div>
          {systemMsgs.map((t) => (
            <SystemMessageCard
              key={t.id}
              template={t}
              userName={userName}
              onPersonalize={personalize}
            />
          ))}
        </>
      )}

      {tabTemplates.length === 0 && !showNewForm && (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "12px",
            background: C.card,
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>📝</div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "16px",
              color: C.dark,
              marginBottom: "6px",
            }}
          >
            {tr("templates.emptyTitle")}
          </div>
          <div style={{ fontSize: "12px", color: C.muted }}>
            {tr("templates.emptyHint")}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: C.text2,
  marginBottom: "5px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: C.bg,
  border: `1.5px solid ${C.border}`,
  borderRadius: "9px",
  fontSize: "13px",
  color: C.dark,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const ghostBtn: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "11px",
  fontWeight: 500,
  background: C.bg2,
  border: `1px solid ${C.border}`,
  borderRadius: "8px",
  color: C.text2,
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
  whiteSpace: "nowrap",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  margin: "6px 0 10px",
};
