import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

const VARIABLES = [
  { key: "{{nume}}", desc: "Numele clientului" },
  { key: "{{zile}}", desc: "Zile de la ultima ofertă" },
  { key: "{{produse}}", desc: "Lista produselor" },
  { key: "{{total}}", desc: "Totalul ofertei" },
  { key: "{{distribuitor}}", desc: "Numele tău" },
  { key: "{{telefon}}", desc: "Telefonul tău" },
];

const TEMPLATE_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  followup_1: { label: "Follow-up #1", color: "#B8860B", bg: "#FFF8E7" },
  followup_2: { label: "Follow-up #2", color: C.primary, bg: C.bg2 },
  followup_3: { label: "Follow-up #3 (Final)", color: C.red, bg: C.redbg },
};

interface Template {
  id: string;
  subject: string;
  body_html: string;
  trigger_day: number;
  active: boolean;
  language_code: string;
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
    return {
      type: "followup_1",
      headline: "",
      intro: "",
      cta: "",
      closing: "",
    };
  }
}

function buildPreviewHtml(body: TemplateBody, _subject: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E0D4F8;">
      <div style="background:#4A3270;padding:20px;text-align:center;">
        <div style="color:white;font-size:20px;margin-bottom:4px">AromaTool</div>
        <div style="color:#C8BFFF;font-size:10px;letter-spacing:2px;font-style:italic">crafted for your team</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:16px;color:#4A3270;font-weight:600;margin-bottom:12px">${body.headline || "..."}</p>
        <p style="font-size:13px;color:#6B5B9E;line-height:1.7;margin-bottom:16px">${body.intro || "..."}</p>
        <div style="background:#F5F0FF;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
          <div style="font-size:11px;color:#9B80C4;margin-bottom:4px">📦 Produse oferta anterioară:</div>
          <div style="font-size:12px;color:#4A3270;">{{produse}}</div>
        </div>
        <div style="text-align:center;margin-bottom:16px;">
          <a style="display:inline-block;background:linear-gradient(135deg,#7B5EA7,#4A3270);border-radius:10px;padding:11px 28px;color:white;font-size:13px;font-weight:600;text-decoration:none;">${body.cta || "Scrie-mi"} →</a>
        </div>
        <p style="font-size:12px;color:#9B80C4;text-align:center">${body.closing || "Cu drag"}, <strong style="color:#4A3270">{{distribuitor}}</strong></p>
      </div>
      <div style="background:#F9F7FF;border-top:1px solid #F0EEFF;padding:10px;text-align:center;">
        <span style="font-size:10px;color:#C4A8E8">Trimis prin AromaTool</span>
      </div>
    </div>
  `;
}

export default function FollowupTemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<TemplateBody>({
    type: "",
    headline: "",
    intro: "",
    cta: "",
    closing: "",
  });
  const [editSubject, setEditSubject] = useState("");
  const [editDays, setEditDays] = useState(5);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    const { data } = await supabase
      .from("followup_templates")
      .select("id, subject, body_html, trigger_day, active, language_code")
      .eq("language_code", "ro")
      .order("trigger_day");
    if (data) setTemplates(data);
    setLoading(false);
  }

  function startEdit(t: Template) {
    setEditingId(t.id);
    setEditBody(parseBody(t.body_html));
    setEditSubject(t.subject);
    setEditDays(t.trigger_day);
    setShowPreview(false);
  }

  async function saveTemplate() {
    if (!editingId) return;
    setSaving(true);
    await supabase
      .from("followup_templates")
      .update({
        subject: editSubject,
        body_html: JSON.stringify(editBody),
        trigger_day: editDays,
      })
      .eq("id", editingId);
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? {
              ...t,
              subject: editSubject,
              body_html: JSON.stringify(editBody),
              trigger_day: editDays,
            }
          : t,
      ),
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setEditingId(null);
    }, 1500);
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase
      .from("followup_templates")
      .update({ active: !active })
      .eq("id", id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !active } : t)),
    );
  }

  if (loading)
    return (
      <div style={{ padding: "20px", color: C.muted, fontSize: "13px" }}>
        Se încarcă template-urile...
      </div>
    );

  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: C.primary,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "16px",
        }}
      >
        📧 Template-uri Follow-up
      </div>

      {/* Variables reference */}
      <div
        style={{
          background: C.bg2,
          borderRadius: "10px",
          padding: "12px 14px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: C.primary,
            marginBottom: "8px",
          }}
        >
          Variabile disponibile — click pentru a copia:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                navigator.clipboard.writeText(v.key);
              }}
              title={v.desc}
              style={{
                padding: "3px 10px",
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
        <div style={{ fontSize: "10px", color: C.muted, marginTop: "6px" }}>
          Click pe o variabilă → se copiază → o lipești în câmpul dorit
        </div>
      </div>

      {/* Templates list */}
      {templates.map((t) => {
        const body = parseBody(t.body_html);
        const info = TEMPLATE_LABELS[body.type] || TEMPLATE_LABELS.followup_1;
        const isEditing = editingId === t.id;

        return (
          <div
            key={t.id}
            style={{
              background: C.card,
              border: `1px solid ${C.border2}`,
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "12px",
              opacity: t.active ? 1 : 0.6,
            }}
          >
            {/* Template header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: isEditing ? "16px" : "0",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: info.bg,
                    color: info.color,
                  }}
                >
                  {info.label}
                </span>
                <span style={{ fontSize: "12px", color: C.muted }}>
                  ⏰ după {t.trigger_day} zile
                </span>
                <span
                  style={{ fontSize: "12px", color: C.dark, fontWeight: 500 }}
                >
                  "{t.subject}"
                </span>
              </div>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <button
                  onClick={() => toggleActive(t.id, t.active)}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 500,
                    background: t.active ? C.greenbg : "#F5F5F5",
                    border: `1px solid ${t.active ? C.green : "#DDD"}`,
                    borderRadius: "999px",
                    color: t.active ? C.green : "#999",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t.active ? "✓ Activ" : "✗ Inactiv"}
                </button>
                <button
                  onClick={() =>
                    isEditing ? setEditingId(null) : startEdit(t)
                  }
                  style={{
                    padding: "4px 12px",
                    fontSize: "12px",
                    background: C.bg2,
                    border: `1px solid ${C.border2}`,
                    borderRadius: "8px",
                    color: C.dark,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isEditing ? "Anulează" : "✏️ Editează"}
                </button>
              </div>
            </div>

            {/* Editor */}
            {isEditing && (
              <div>
                {/* Days + Subject */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Zile după ofertă</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={editDays}
                      onChange={(e) =>
                        setEditDays(parseInt(e.target.value) || 5)
                      }
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Subiect email</label>
                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Subiectul emailului..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Headline */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>Titlu principal</label>
                  <input
                    value={editBody.headline}
                    onChange={(e) =>
                      setEditBody((p) => ({ ...p, headline: e.target.value }))
                    }
                    placeholder="ex: Ai văzut oferta mea?"
                    style={inputStyle}
                  />
                </div>

                {/* Intro */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={labelStyle}>
                    Mesajul principal (poți folosi variabile)
                  </label>
                  <textarea
                    value={editBody.intro}
                    rows={4}
                    onChange={(e) =>
                      setEditBody((p) => ({ ...p, intro: e.target.value }))
                    }
                    placeholder="ex: Bună {{nume}}, revin cu oferta trimisă acum {{zile}} zile..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {/* CTA + Closing */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <label style={labelStyle}>Text buton</label>
                    <input
                      value={editBody.cta}
                      onChange={(e) =>
                        setEditBody((p) => ({ ...p, cta: e.target.value }))
                      }
                      placeholder="ex: Scrie-mi"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Semnătură</label>
                    <input
                      value={editBody.closing}
                      onChange={(e) =>
                        setEditBody((p) => ({ ...p, closing: e.target.value }))
                      }
                      placeholder="ex: Cu drag"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: saved
                        ? C.greenbg
                        : `linear-gradient(135deg, ${C.primary}, #4A3270)`,
                      border: saved ? `1px solid ${C.green}` : "none",
                      borderRadius: "9px",
                      color: saved ? C.green : "white",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {saving
                      ? "Se salvează..."
                      : saved
                        ? "✅ Salvat!"
                        : "Salvează template"}
                  </button>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      padding: "10px 16px",
                      background: C.bg2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: "9px",
                      color: C.dark,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {showPreview ? "Ascunde" : "👁 Preview"}
                  </button>
                </div>

                {/* Preview */}
                {showPreview && (
                  <div style={{ marginTop: "14px" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        color: C.muted,
                        marginBottom: "8px",
                        fontWeight: 500,
                      }}
                    >
                      PREVIEW EMAIL
                    </div>
                    <div
                      style={{
                        border: `1px solid ${C.border2}`,
                        borderRadius: "10px",
                        overflow: "hidden",
                      }}
                    >
                      <iframe
                        srcDoc={buildPreviewHtml(editBody, editSubject)}
                        style={{
                          width: "100%",
                          height: "500px",
                          border: "none",
                        }}
                        title="Email preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: "#6B5B9E",
  marginBottom: "5px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#F9F7FF",
  border: "1.5px solid rgba(196,168,232,0.4)",
  borderRadius: "9px",
  fontSize: "13px",
  color: "#2D1A4E",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
