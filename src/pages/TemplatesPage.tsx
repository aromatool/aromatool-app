import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { useSubscription } from "../lib/subscription";
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

// Câmpuri de personalizare inserabile — eticheta descriptivă vine din i18n
// (templates.variables.<id>). Tokenul real salvat în text este `{{<id>}}`.
// Le grupăm pe câmp: în subiect/titlu au sens doar numele/numele tău; în
// mesajul principal pot apărea și produsele, totalul, zilele.
const SUBJECT_FIELDS = ["nume", "distribuitor"];
const HEADLINE_FIELDS = ["nume", "distribuitor"];
const BODY_FIELDS = ["nume", "produse", "total", "zile", "distribuitor", "telefon"];

// Tab-uri pe ACȚIUNE (legate de Recommended Action), nu pe status/zile.
// Label/desc vin din i18n (templates.tabs.<key>.label / .desc).
const TABS = [
  { key: "needs_offer" },
  { key: "needs_followup" },
  { key: "first_order" },
  { key: "reorder" },
  { key: "reactivate" },
  { key: "discuss_business" },
];

// Acțiunile care vizează clienți (nu prospecți) — pentru trigger_status la
// crearea unui mesaj propriu (câmp legacy, nu afectează fluxul pe acțiune).
const CLIENT_ACTIONS = ["discuss_business", "first_order", "reorder"];

interface Template {
  id: string;
  subject: string;
  body_html: string;
  title: string | null;
  trigger_action: string | null;
  active: boolean;
  user_id: string | null; // null = mesaj de sistem (global)
  system_key: string | null;
  language_code: string | null;
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

// Tabelul cu „oferta anterioară" apare în emailul REAL doar la Follow-up
// (`offerForEmail = trigger_action === "needs_followup" ? lastOffer : null`
// în FollowupModal.tsx) — și doar dacă există o ofertă reală cu produse.
// Preview-ul respectă exact aceeași regulă, ca să nu inducă în eroare.
const OFFER_TABS = new Set(["needs_followup"]);

// Tabel de ofertă identic cu cel din emailul real (buildEmailHtml), cu date
// de exemplu — ca preview-ul să arate la fel cu ce primește clientul.
const SAMPLE_OFFER_HTML = `<div style="margin-bottom:18px;">
  <div style="font-size:11px;color:#A89888;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:8px">Oferta anterioară</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #EDE8E0;border-radius:10px;overflow:hidden;">
    <thead><tr style="background:#F5EEE8;">
      <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:left;font-weight:500">Produs</th>
      <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:center;font-weight:500">Cant.</th>
      <th style="padding:8px 16px;font-size:11px;color:#A89888;text-align:right;font-weight:500">Total</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#3D3530">Lavender 15ml</td>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#A89888;text-align:center">×2</td>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;font-weight:600;color:#4A6A4A;text-align:right">130,00 RON</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#3D3530">Peppermint 15ml</td>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;color:#A89888;text-align:center">×1</td>
        <td style="padding:10px 16px;border-bottom:1px solid #EDE8E0;font-size:13px;font-weight:600;color:#4A6A4A;text-align:right">115,00 RON</td>
      </tr>
    </tbody>
  </table>
  <div style="text-align:right;margin-top:8px;font-family:'Helvetica Neue',Arial,sans-serif;">
    <span style="font-size:13px;color:#A89888">Total: </span>
    <span style="font-size:18px;font-weight:700;color:#4A6A4A">245,00 RON</span>
  </div>
</div>`;

function buildPreviewHtml(
  body: TemplateBody,
  subject: string,
  userName = "Distribuitorul tău",
  userPhone?: string,
  userEmail?: string,
  userSignature?: string,
  triggerAction?: string | null,
): string {
  const sub = (t: string) =>
    t
      .replace(/{{nume}}/g, "<strong>Maria</strong>")
      .replace(/{{zile}}/g, "<strong>5</strong>")
      .replace(/{{produse}}/g, "<strong>Lavender 15ml ×2, Peppermint 15ml ×1</strong>")
      .replace(/{{total}}/g, "<strong>245,00 RON</strong>")
      .replace(/{{distribuitor}}/g, `<strong>${userName}</strong>`)
      .replace(/{{telefon}}/g, "<strong>0712 345 678</strong>");
  const offerBlock = triggerAction && OFFER_TABS.has(triggerAction) ? SAMPLE_OFFER_HTML : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#FAFAF7;font-family:Georgia,serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EDE8E0;">
      ${EMAIL_HEADER_HTML}
      <div style="padding:26px 24px;">
        <p style="font-size:12px;color:#A89888;margin-bottom:6px;text-align:center">Subiect: <strong style="color:#4A6A4A">${sub(subject) || "..."}</strong></p>
        <p style="font-size:16px;color:#4A6A4A;font-weight:600;margin:14px 0 12px;text-align:center">${sub(body.headline) || "..."}</p>
        <p style="font-size:13px;color:#6A5A50;line-height:1.8;margin-bottom:18px;white-space:pre-wrap">${sub(body.intro) || "..."}</p>
        ${offerBlock}
      </div>
      ${buildEmailFooter({ userName, userPhone, userEmail, userSignature })}
      <div style="background:#FAFAF7;border-top:1px solid #EDE8E0;padding:10px;text-align:center;">
        <span style="font-size:10px;color:#C8D8C8">Trimis prin AromaTool</span>
      </div>
    </div>
  </body></html>`;
}

// ── CÂMP CU PERSONALIZARE (insert-la-cursor) ───────────────
// Un câmp (input sau textarea) însoțit de butoane verzi care adaugă
// câmpurile de personalizare exact acolo unde e cursorul — fără copy/paste.
function PersonalizeField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  fieldIds,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  fieldIds: string[];
}) {
  const { t: tr } = useTranslation();
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    // adaugă un spațiu înainte dacă textul nu se termină deja cu spațiu
    const needsSpace = start > 0 && !/\s/.test(value[start - 1] ?? "");
    const ins = (needsSpace ? " " : "") + token;
    onChange(value.slice(0, start) + ins + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + ins.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div style={{ marginBottom: "10px" }}>
      <label style={labelStyle}>{label}</label>
      {rows ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
        {fieldIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => insert(`{{${id}}}`)}
            title={tr("templates.insertTitle")}
            style={insertChipStyle}
          >
            <i className="ti ti-plus" style={{ fontSize: "11px", opacity: 0.7 }} aria-hidden="true" />
            {tr(`templates.variables.${id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── CARD MESAJ DE SISTEM (read-only) ───────────────────────
function SystemMessageCard({
  template,
  userName,
  onPersonalize,
  locked,
}: {
  template: Template;
  userName: string;
  onPersonalize: (t: Template) => void;
  locked: boolean;
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
          {!locked && (
            <button onClick={() => setShowPreview(!showPreview)} style={ghostBtn}>
              {showPreview ? tr("templates.hide") : "👁"}
            </button>
          )}
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
              template.trigger_action,
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
  locked,
}: {
  template: Template;
  onSave: (id: string, data: Partial<Template>) => void;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  userName: string;
  locked: boolean;
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.dark,
              minWidth: 0,
            }}
          >
            {template.title || template.subject}
          </span>
          <span
            style={{
              fontSize: "10px",
              background: "#EDE8E0",
              color: C.text2,
              padding: "2px 8px",
              borderRadius: "999px",
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {tr("templates.mine")}
          </span>
        </div>
        <div
          style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggle(template.id, template.active)}
            style={{
              padding: "5px 11px",
              fontSize: "11px",
              fontWeight: 600,
              background: template.active ? C.greenbg : "#F5F5F5",
              border: `1px solid ${template.active ? C.green : "#DDD"}`,
              borderRadius: "999px",
              color: template.active ? C.green : "#999",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {template.active ? tr("templates.active") : tr("templates.inactive")}
          </button>
          <button
            onClick={() => onDelete(template.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "5px 9px",
              fontSize: "14px",
              lineHeight: 1,
              background: C.redbg,
              border: `1px solid rgba(201,79,106,0.2)`,
              borderRadius: "8px",
              color: C.red,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
            title={tr("templates.deleteTitle")}
            aria-label={tr("templates.deleteTitle")}
          >
            <i className="ti ti-trash" />
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

            <PersonalizeField
              label={tr("templates.subjectLabel")}
              value={subject}
              onChange={setSubject}
              placeholder={tr("templates.subjectPlaceholder")}
              fieldIds={SUBJECT_FIELDS}
            />

            <PersonalizeField
              label={tr("templates.headlineLabel")}
              value={editBody.headline}
              onChange={(v) => setEditBody((p) => ({ ...p, headline: v }))}
              placeholder={tr("templates.headlinePlaceholderEdit")}
              fieldIds={HEADLINE_FIELDS}
            />

            <PersonalizeField
              label={tr("templates.bodyLabel")}
              value={editBody.intro}
              onChange={(v) => setEditBody((p) => ({ ...p, intro: v }))}
              placeholder={tr("templates.bodyPlaceholderEdit")}
              rows={4}
              fieldIds={BODY_FIELDS}
            />

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
              {!locked && (
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
              )}
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
                    template.trigger_action,
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
  const { t: tr, i18n } = useTranslation();
  const uiLang = i18n.language?.startsWith("en") ? "en" : "ro";
  const { user } = useAuth();
  const { hasAccess } = useSubscription();
  const locked = !hasAccess;
  const [activeTab, setActiveTab] = useState("needs_offer");
  // Limba mesajelor afișate/editate. Implicit limba interfeței, dar o poți
  // comuta ca să vezi/editezi și varianta în cealaltă limbă (la trimitere poți
  // alege limba emailului per contact, deci ai nevoie de ambele variante).
  const [viewLang, setViewLang] = useState(uiLang);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState(tr("templates.defaultUserName"));
  const [showNewForm, setShowNewForm] = useState(false);
  const [showNewPreview, setShowNewPreview] = useState(false);
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

  // Detectare mobil — folosită DOAR ca să relaxăm layout-ul pe ecrane mici
  // (taburi scrollabile, butoane full-width). Desktopul rămâne identic.
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
        "id, subject, body_html, title, trigger_action, active, user_id, system_key, language_code",
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
        trigger_status: CLIENT_ACTIONS.includes(activeTab) ? "client_nou" : "prospect",
        trigger_day: 0,
        subject: newTemplate.subject,
        title: newTemplate.title || newTemplate.subject,
        body_html: JSON.stringify(body),
        language_code: viewLang,
        plan_required: "starter",
        active: true,
      })
      .select(
        "id, subject, body_html, title, trigger_action, active, user_id, system_key, language_code",
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
    const { error } = await supabase
      .from("followup_templates")
      .update(updates)
      .eq("id", id);
    if (error) {
      alert(tr("templates.saveError"));
      return;
    }
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  }

  async function handleToggle(id: string, active: boolean) {
    const { error } = await supabase
      .from("followup_templates")
      .update({ active: !active })
      .eq("id", id);
    if (error) {
      alert(tr("templates.saveError"));
      return;
    }
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !active } : t)),
    );
  }

  async function handleDelete(id: string) {
    if (!confirm(tr("templates.deleteConfirm"))) return;
    // Nu scoatem optimist din UI: ștergerea poate eșua (ex. mesajul a fost deja
    // folosit la o trimitere → FK din followup_log). Verificăm eroarea întâi.
    const { error } = await supabase
      .from("followup_templates")
      .delete()
      .eq("id", id);
    if (error) {
      // 23503 = foreign_key_violation (mesaj referit în followup_log).
      alert(
        error.code === "23503"
          ? tr("templates.deleteErrorInUse")
          : tr("templates.deleteError"),
      );
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  // Afișăm doar mesajele pe limba interfeței (un mesaj RO și echivalentul lui
  // EN au același rol — n-are sens să le vezi pe amândouă). Rândurile fără
  // language_code (legacy) rămân vizibile ca să nu ascundem mesaje vechi.
  const tabTemplates = templates.filter(
    (t) =>
      t.trigger_action === activeTab &&
      (t.language_code === viewLang || t.language_code == null),
  );
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
    <div className="tpl-page" style={{ maxWidth: "720px", margin: "0 auto" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .tpl-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          /* font 16px pe mobil = previne auto-zoom-ul iOS la focus pe input */
          .tpl-page input, .tpl-page textarea { font-size: 16px !important; }
        }
      `}</style>

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

      {/* Cum funcționează — explicație în limbaj simplu */}
      <div
        style={{
          background: C.sageLight,
          borderRadius: "12px",
          padding: "14px 16px",
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            lineHeight: 1,
            flexShrink: 0,
            marginTop: "2px",
          }}
          aria-hidden="true"
        >
          💡
        </div>
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: C.primaryDark,
              marginBottom: "4px",
            }}
          >
            {tr("templates.howToTitle")}
          </div>
          <div style={{ fontSize: "12px", color: C.text2, lineHeight: 1.6 }}>
            {tr("templates.howToText")}
          </div>
        </div>
      </div>

      {/* Selector limbă mesaje — la trimitere alegi limba emailului per contact,
          deci poți edita aici atât varianta RO cât și EN. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: "12px", color: C.muted }}>
          {tr("templates.langLabel")}
        </span>
        <div
          style={{
            display: "inline-flex",
            background: C.bg2,
            borderRadius: "8px",
            padding: "3px",
            gap: "2px",
          }}
        >
          {(["ro", "en"] as const).map((lng) => (
            <button
              key={lng}
              onClick={() => setViewLang(lng)}
              style={{
                padding: "4px 14px",
                border: "none",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: viewLang === lng ? 600 : 500,
                background: viewLang === lng ? "white" : "transparent",
                color: viewLang === lng ? C.dark : C.muted,
                boxShadow:
                  viewLang === lng ? "0 1px 6px rgba(92,122,92,0.12)" : "none",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {lng === "ro" ? "🇷🇴 RO" : "🇬🇧 EN"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs — pe mobil scrollabile orizontal (textul rămâne pe un rând) */}
      <div
        className="tpl-tabs"
        style={{
          display: "flex",
          background: C.bg2,
          borderRadius: "12px",
          padding: "4px",
          marginBottom: "20px",
          gap: "2px",
          ...(isMobile
            ? {
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
              }
            : {}),
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
              flex: isMobile ? "0 0 auto" : 1,
              padding: isMobile ? "10px 14px" : "10px 6px",
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
              whiteSpace: isMobile ? "nowrap" : "normal",
            }}
          >
            {tr(`templates.tabs.${tab.key}.label`)}
          </button>
        ))}
      </div>

      {/* „Când se folosește" + add — pe mobil stivuit, buton full-width */}
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "stretch" : "flex-start",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          gap: isMobile ? "10px" : "12px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            flex: 1,
            background: C.bg2,
            borderRadius: "10px",
            padding: "10px 12px",
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
          }}
        >
          <i
            className="ti ti-clock-hour-4"
            style={{ fontSize: "15px", color: C.primary, marginTop: "1px", flexShrink: 0 }}
            aria-hidden="true"
          />
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: C.primaryDark,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "2px",
              }}
            >
              {tr("templates.whenUsedLabel")}
            </div>
            <div style={{ fontSize: "12px", color: C.text2, lineHeight: 1.5 }}>
              {tr(`templates.tabs.${activeTab}.desc`)}
            </div>
            {activeTab === "needs_followup" && (
              <div
                style={{
                  fontSize: "11px",
                  color: C.primaryDark,
                  lineHeight: 1.5,
                  marginTop: "6px",
                  display: "flex",
                  gap: "5px",
                  alignItems: "flex-start",
                }}
              >
                <i
                  className="ti ti-package"
                  style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}
                  aria-hidden="true"
                />
                <span>{tr("templates.autoProductsHint")}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            width: isMobile ? "100%" : "auto",
            flexShrink: 0,
            padding: isMobile ? "11px 14px" : "7px 14px",
            border: showNewForm ? `1px solid ${C.border2}` : "none",
            borderRadius: "9px",
            background: showNewForm ? C.bg2 : C.primary,
            color: showNewForm ? C.dark : "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: isMobile ? "13px" : "12px",
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
              fontSize: "13px",
              fontWeight: 600,
              color: C.primary,
              marginBottom: "4px",
            }}
          >
            {tr("templates.newFormTitle", { tab: tr(`templates.tabs.${activeTab}.label`) })}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.text2,
              lineHeight: 1.5,
              marginBottom: "14px",
            }}
          >
            {tr("templates.newFormHint")}
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

          <PersonalizeField
            label={tr("templates.subjectLabel")}
            value={newTemplate.subject}
            onChange={(v) => setNewTemplate((p) => ({ ...p, subject: v }))}
            placeholder={tr("templates.subjectPlaceholder")}
            fieldIds={SUBJECT_FIELDS}
          />

          <PersonalizeField
            label={tr("templates.headlineLabel")}
            value={newTemplate.headline}
            onChange={(v) => setNewTemplate((p) => ({ ...p, headline: v }))}
            placeholder={tr("templates.headlinePlaceholderNew")}
            fieldIds={HEADLINE_FIELDS}
          />

          <PersonalizeField
            label={tr("templates.bodyLabel")}
            value={newTemplate.intro}
            onChange={(v) => setNewTemplate((p) => ({ ...p, intro: v }))}
            placeholder={tr("templates.bodyPlaceholderNew")}
            rows={3}
            fieldIds={BODY_FIELDS}
          />

          <button
            onClick={() => setShowNewPreview((v) => !v)}
            style={{
              width: "100%",
              padding: "10px 14px",
              marginBottom: "10px",
              background: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: "9px",
              color: C.dark,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {showNewPreview ? tr("templates.hide") : tr("templates.preview")}
          </button>

          {showNewPreview && (
            <div
              style={{
                marginBottom: "12px",
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <iframe
                srcDoc={buildPreviewHtml(
                  {
                    type: "structured",
                    headline: newTemplate.headline,
                    intro: newTemplate.intro,
                    cta: "",
                    closing: "",
                  },
                  newTemplate.subject,
                  userName,
                  user?.user_metadata?.phone,
                  user?.user_metadata?.contact_email || user?.email,
                  user?.user_metadata?.email_signature,
                  activeTab,
                )}
                style={{ width: "100%", height: "480px", border: "none" }}
                title="preview"
              />
            </div>
          )}

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
              locked={locked}
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
              locked={locked}
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

const insertChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 10px",
  background: C.sageLight,
  border: `1px solid ${C.border2}`,
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 600,
  color: C.primary,
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
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
