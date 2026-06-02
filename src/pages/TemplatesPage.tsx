import { useEffect, useState } from "react";
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

const VARIABLES = [
  { key: "{{nume}}", desc: "Numele clientului" },
  { key: "{{zile}}", desc: "Zile de la ultima ofertă" },
  { key: "{{produse}}", desc: "Lista produselor din ofertă" },
  { key: "{{total}}", desc: "Totalul ofertei" },
  { key: "{{distribuitor}}", desc: "Numele tău" },
  { key: "{{telefon}}", desc: "Telefonul tău" },
];

const TABS = [
  {
    key: "prospect",
    label: "🟡 Prospecți",
    desc: "Follow-up după trimiterea ofertei",
  },
  {
    key: "client_nou",
    label: "🟢 Clienți noi",
    desc: "Mesaje după prima comandă",
  },
  {
    key: "client_fidel",
    label: "⭐ Clienți fideli",
    desc: "Retenție și loialitate",
  },
];

interface Template {
  id: string;
  subject: string;
  body_html: string;
  trigger_day: number;
  active: boolean;
  trigger_status: string;
  user_id: string | null;
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

function buildPreviewHtml(
  body: TemplateBody,
  subject: string,
  userName = "Distribuitorul tău",
): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#F5F0FF;font-family:Georgia,serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E0D4F8;">
      <div style="background:#4A3270;padding:20px 24px;text-align:center;">
        <div style="color:white;font-size:20px;margin-bottom:3px">AromaTool</div>
        <div style="color:#C8BFFF;font-size:10px;letter-spacing:2px;font-style:italic">crafted for your team</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:13px;color:#9B80C4;margin-bottom:4px;text-align:center">Subiect: <strong style="color:#4A3270">${subject || "..."}</strong></p>
        <p style="font-size:16px;color:#4A3270;font-weight:600;margin:16px 0 10px;text-align:center">${body.headline || "..."}</p>
        <p style="font-size:13px;color:#6B5B9E;line-height:1.7;margin-bottom:16px">${(
          body.intro || "..."
        )
          .replace(/{{nume}}/g, "<strong>Maria</strong>")
          .replace(/{{zile}}/g, "<strong>5</strong>")
          .replace(/{{distribuitor}}/g, `<strong>${userName}</strong>`)}</p>
        <div style="background:#F5F0FF;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
          <div style="font-size:11px;color:#9B80C4;margin-bottom:6px">📦 Produse din oferta anterioară:</div>
          <div style="font-size:12px;color:#4A3270">• Lavender 15ml ×2<br>• Peppermint 15ml ×1</div>
          <div style="font-size:12px;color:#7B5EA7;font-weight:600;margin-top:6px">💜 Total: 245,00 RON</div>
        </div>
        <div style="text-align:center;margin-bottom:16px;">
          <a style="display:inline-block;background:linear-gradient(135deg,#7B5EA7,#4A3270);border-radius:10px;padding:11px 28px;color:white;font-size:13px;font-weight:600;text-decoration:none;">${body.cta || "Scrie-mi"} →</a>
        </div>
        <p style="font-size:12px;color:#9B80C4;text-align:center;margin:0">${body.closing || "Cu drag"}, <strong style="color:#4A3270">${userName}</strong></p>
      </div>
      <div style="background:#F9F7FF;border-top:1px solid #F0EEFF;padding:10px;text-align:center;">
        <span style="font-size:10px;color:#C4A8E8">Trimis prin AromaTool</span>
      </div>
    </div>
  </body></html>`;
}

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
  const body = parseBody(template.body_html);
  const [editBody, setEditBody] = useState<TemplateBody>(body);
  const [subject, setSubject] = useState(template.subject);
  const [days, setDays] = useState(template.trigger_day);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const STEP_LABELS: Record<string, string> = {
    followup_1: "1️⃣ Primul follow-up",
    followup_2: "2️⃣ Al doilea follow-up",
    followup_3: "3️⃣ Ultimul follow-up",
  };

  async function save() {
    setSaving(true);
    await onSave(template.id, {
      subject,
      body_html: JSON.stringify(editBody),
      trigger_day: days,
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.dark }}>
            {STEP_LABELS[body.type] || body.type}
          </span>
          <span style={{ fontSize: "12px", color: C.muted }}>
            ⏰ după {template.trigger_day} zile · "{template.subject}"
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
            {template.active ? "✓ Activ" : "✗ Oprit"}
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
            title="Șterge template"
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
        <div
          style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}
        >
          <div style={{ marginTop: "14px" }}>
            {/* Days + Subject */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <label style={labelStyle}>Zile după ofertă</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Subiect email</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subiectul emailului..."
                  style={inputStyle}
                />
              </div>
            </div>

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

            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Mesajul principal</label>
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

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={save}
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
                  padding: "10px 14px",
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
                  srcDoc={buildPreviewHtml(editBody, subject, userName)}
                  style={{ width: "100%", height: "520px", border: "none" }}
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("prospect");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Distribuitorul tău");
  const [showNewForm, setShowNewForm] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    trigger_day: 7,
    subject: "",
    headline: "",
    intro: "",
    cta: "Scrie-mi",
    closing: "Cu drag",
  });

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
        trigger_day: newTemplate.trigger_day,
        subject: newTemplate.subject,
        body_html: JSON.stringify(body),
        language_code: "ro",
        plan_required: "starter",
        trigger_status: activeTab,
        active: true,
      })
      .select("*")
      .single();
    if (data) setTemplates((prev) => [...prev, data]);
    setNewTemplate({
      trigger_day: 7,
      subject: "",
      headline: "",
      intro: "",
      cta: "Scrie-mi",
      closing: "Cu drag",
    });
    setShowNewForm(false);
    setAddingSaving(false);
  }

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

    // Încearcă să încarce template-urile utilizatorului
    let { data } = await supabase
      .from("followup_templates")
      .select("*")
      .eq("user_id", user!.id)
      .order("trigger_day");

    // Dacă nu are template-uri proprii, copiază din cele globale
    if (!data || data.length === 0) {
      const { data: globalTemplates } = await supabase
        .from("followup_templates")
        .select("*")
        .is("user_id", null)
        .order("trigger_day");

      if (globalTemplates && globalTemplates.length > 0) {
        // Copiază template-urile globale pentru acest user
        const copies = globalTemplates.map((t) => ({
          ...t,
          id: undefined,
          user_id: user!.id,
        }));

        const { data: inserted } = await supabase
          .from("followup_templates")
          .insert(copies)
          .select("*");

        data = inserted || [];
      }
    }

    setTemplates(data || []);
    setLoading(false);
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
    if (!confirm("Ștergi acest template?")) return;
    await supabase.from("followup_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const tabTemplates = templates.filter((t) => t.trigger_status === activeTab);
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  if (loading)
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "60px" }}
      >
        <div
          style={{
            width: "28px",
            height: "28px",
            border: "3px solid #E8E0F8",
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
          Template-uri mesaje
        </div>
        <div style={{ fontSize: "13px", color: C.muted }}>
          Personalizează mesajele de follow-up pentru fiecare tip de client.
          Folosește variabilele pentru a face mesajele personale.
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
          Variabile disponibile — click pentru a copia
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginBottom: "6px",
          }}
        >
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => {
                navigator.clipboard.writeText(v.key);
              }}
              title={`Click să copiezi · ${v.desc}`}
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
          Click pe o variabilă → se copiază automat → lipești în câmpul dorit
          din template
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
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: "10px 8px",
              border: "none",
              borderRadius: "9px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px",
              fontWeight: activeTab === tab.key ? 600 : 400,
              background: activeTab === tab.key ? "white" : "transparent",
              color: activeTab === tab.key ? C.dark : C.muted,
              boxShadow:
                activeTab === tab.key
                  ? "0 1px 6px rgba(123,94,167,0.12)"
                  : "none",
              transition: "all 0.15s",
              textAlign: "center",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "12px", color: C.muted }}>
          {currentTab.desc} · {tabTemplates.filter((t) => t.active).length}{" "}
          active din {tabTemplates.length}
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            padding: "7px 14px",
            background: showNewForm ? C.bg2 : C.primary,
            border: "none",
            borderRadius: "9px",
            color: "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            ...(showNewForm
              ? {
                  background: C.bg2,
                  color: C.dark,
                  border: `1px solid ${C.border2}`,
                }
              : {}),
          }}
        >
          {showNewForm ? "✕ Anulează" : "+ Template nou"}
        </button>
      </div>

      {/* New template form */}
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
            ✨ Template nou — {currentTab.label}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <div>
              <label style={labelStyle}>Zile după ofertă</label>
              <input
                type="number"
                min={1}
                max={60}
                value={newTemplate.trigger_day}
                onChange={(e) =>
                  setNewTemplate((p) => ({
                    ...p,
                    trigger_day: parseInt(e.target.value) || 1,
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Subiect email</label>
              <input
                value={newTemplate.subject}
                onChange={(e) =>
                  setNewTemplate((p) => ({ ...p, subject: e.target.value }))
                }
                placeholder="Subiectul emailului..."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>Titlu principal</label>
            <input
              value={newTemplate.headline}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, headline: e.target.value }))
              }
              placeholder="ex: O ofertă specială pentru tine"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>Mesajul principal</label>
            <textarea
              value={newTemplate.intro}
              rows={3}
              onChange={(e) =>
                setNewTemplate((p) => ({ ...p, intro: e.target.value }))
              }
              placeholder="ex: Bună {{nume}}, am ceva special pentru tine..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

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
                value={newTemplate.cta}
                onChange={(e) =>
                  setNewTemplate((p) => ({ ...p, cta: e.target.value }))
                }
                placeholder="ex: Scrie-mi"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Semnătură</label>
              <input
                value={newTemplate.closing}
                onChange={(e) =>
                  setNewTemplate((p) => ({ ...p, closing: e.target.value }))
                }
                placeholder="ex: Cu drag"
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={addTemplate}
            disabled={addingSaving}
            style={{
              width: "100%",
              padding: "10px",
              background: `linear-gradient(135deg, ${C.primary}, #4A3270)`,
              border: "none",
              borderRadius: "9px",
              color: "white",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {addingSaving ? "Se salvează..." : "+ Adaugă template"}
          </button>
        </div>
      )}

      {/* Templates */}
      {tabTemplates.length === 0 ? (
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
            Nu există template-uri pentru această categorie
          </div>
          <div style={{ fontSize: "12px", color: C.muted }}>
            Template-urile pentru clienți noi și fideli vor fi disponibile în
            curând
          </div>
        </div>
      ) : (
        tabTemplates.map((t) => (
          <TemplateEditor
            key={t.id}
            template={t}
            onSave={handleSave}
            onToggle={handleToggle}
            onDelete={handleDelete}
            userName={userName}
          />
        ))
      )}
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
