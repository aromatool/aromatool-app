import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { statusGroup, type StatusGroup } from "../lib/recommendedAction";
import type { Contact } from "../lib/contactTypes";
import { buildCampaignHtml, buildCampaignText, applyNameToken } from "../lib/campaignEmail";
import { uploadCampaignImage } from "../lib/uploadCampaignImage";

// ── BLOSSOM SAGE COLORS (aliniat cu ContactsPage / ResourcesPage) ──
const C = {
  sage: "#5C7A5C",
  sageDark: "#4A6A4A",
  sageLight: "#E8F0E8",
  cream: "#FAFAF7",
  linen: "#F5EEE8",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
  red: "#C94F6A",
  redLight: "#FFF0F4",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: C.warm,
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: C.cream,
  border: `0.5px solid ${C.border}`,
  borderRadius: 9,
  fontSize: 13,
  color: C.espresso,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const MAX_SUBJECT = 200;
const MAX_BODY = 4000;

const ALL_SEGS: StatusGroup[] = ["team", "client", "prospect", "inactive"];
type SendResult = { sent: number; failed: number; skipped: number };

interface Props {
  contacts: Contact[];
  onClose: () => void;
  // Dacă e setat, fereastra trimite DOAR către acest contact (din detaliul
  // contactului), fără selectorul de segmente.
  lockContact?: Contact | null;
}

// Inserează un text la poziția cursorului într-un input/textarea
// (sau la final dacă nu avem referința).
function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  setter: (v: string) => void,
  token: string,
) {
  if (!el) {
    setter(current + token);
    return;
  }
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  const next = current.slice(0, start) + token + current.slice(end);
  setter(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

export default function GroupEmailModal({ contacts, onClose, lockContact }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Datele liderului (identic cu useSendEmail) — folosite în antet/footer + From.
  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "AromaTool";
  const userPhone = user?.user_metadata?.phone || "";
  const userEmail = user?.user_metadata?.contact_email || user?.email || "";
  const userSignature = user?.user_metadata?.email_signature || "";

  // Multi-select pe categorii (checkbox). Implicit toate = „toți".
  const [selectedSegs, setSelectedSegs] = useState<StatusGroup[]>(ALL_SEGS);
  const [lang, setLang] = useState<string>(
    lockContact?.language_code === "ro"
      ? "ro"
      : lockContact?.language_code?.startsWith("en")
        ? "en"
        : i18n.language?.startsWith("en")
          ? "en"
          : "ro",
  );
  const [subject, setSubject] = useState("");
  const [emailTitle, setEmailTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageErr, setImageErr] = useState<string | null>(null);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Destinatari eligibili: au email real (nu placeholder), neabonați, neblocați.
  const eligibleAll = useMemo(
    () =>
      contacts.filter((c) => {
        const email = (c.email || "").trim();
        if (!email || email.endsWith("@noemail.local")) return false;
        if (c.email_opt_out || c.communication_blocked) return false;
        return true;
      }),
    [contacts],
  );

  const countFor = (seg: StatusGroup) =>
    eligibleAll.filter((c) => statusGroup(c.status) === seg).length;
  const allSelected = selectedSegs.length === ALL_SEGS.length;
  const toggleSeg = (s: StatusGroup) =>
    setSelectedSegs((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const recipients = useMemo(
    () =>
      lockContact
        ? [lockContact]
        : eligibleAll.filter((c) => selectedSegs.includes(statusGroup(c.status))),
    [eligibleAll, selectedSegs, lockContact],
  );
  const recipientIds = recipients.map((c) => c.id);

  // Token pentru prenume, în limba aleasă pentru email.
  const nameToken = lang === "en" ? "{name}" : "{nume}";

  // HTML pentru previzualizare: înlocuim __PRENUME__ cu prenumele unui
  // destinatar (sau gol) ca să arate cum vine personalizat.
  const sampleFirst = (recipients[0]?.name || "").trim().split(/\s+/)[0] || "";
  const previewHtml = useMemo(
    () =>
      buildCampaignHtml({
        title: emailTitle,
        body: body || t("groupEmail.messagePlaceholder"),
        imageUrl: imageUrl || undefined,
        ctaLabel: ctaText,
        ctaUrl,
        userName,
        userPhone,
        userEmail,
        userSignature,
        lang,
      })
        .replaceAll("__PRENUME__", sampleFirst ? ` ${sampleFirst}` : "")
        .replaceAll("__FN__", sampleFirst),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailTitle, body, imageUrl, ctaText, ctaUrl, lang, sampleFirst],
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reselectarea aceluiași fișier
    if (!file || !user?.id) return;
    setImageErr(null);
    if (!file.type.startsWith("image/")) {
      setImageErr(t("groupEmail.imageErrType"));
      return;
    }
    setImageUploading(true);
    try {
      const url = await uploadCampaignImage(file, user.id);
      setImageUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setImageErr(
        msg === "too_large"
          ? t("groupEmail.imageErrSize")
          : msg === "not_image"
            ? t("groupEmail.imageErrType")
            : t("groupEmail.imageErrGeneric"),
      );
    } finally {
      setImageUploading(false);
    }
  }

  function validate(): boolean {
    setErr(null);
    if (!subject.trim()) {
      setErr(t("groupEmail.errNoSubject"));
      return false;
    }
    if (!body.trim()) {
      setErr(t("groupEmail.errNoMessage"));
      return false;
    }
    return true;
  }

  function payloadBase() {
    return {
      subject: applyNameToken(subject.trim()),
      html: buildCampaignHtml({
        title: emailTitle,
        body,
        imageUrl: imageUrl || undefined,
        ctaLabel: ctaText,
        ctaUrl,
        userName,
        userPhone,
        userEmail,
        userSignature,
        lang,
      }),
      text: buildCampaignText({
        title: emailTitle,
        body,
        imageUrl: imageUrl || undefined,
        ctaLabel: ctaText,
        ctaUrl,
        userName,
        userPhone,
        userEmail,
        userSignature,
        lang,
      }),
      from_name: userName,
      reply_to: userEmail || undefined,
    };
  }

  async function doTest() {
    if (!validate()) return;
    setTestMsg(null);
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-group-email", {
        body: { testEmailToSelf: true, ...payloadBase() },
      });
      if (error || data?.error || data?.ok === false) {
        setTestMsg({ ok: false, text: t("groupEmail.testErr", { msg: data?.error || "" }) });
      } else {
        setTestMsg({ ok: true, text: t("groupEmail.testOk", { email: data?.to || userEmail }) });
      }
    } catch {
      setTestMsg({ ok: false, text: t("groupEmail.testErr", { msg: "" }) });
    } finally {
      setTesting(false);
    }
  }

  function askSend() {
    if (!validate()) return;
    if (recipientIds.length === 0) {
      setErr(t("groupEmail.errNoRecipients"));
      return;
    }
    setConfirming(true);
  }

  async function doSend() {
    setConfirming(false);
    setErr(null);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-group-email", {
        body: { contactIds: recipientIds, ...payloadBase() },
      });
      if (error || data?.error || data?.ok === false) {
        setErr(data?.error || t("groupEmail.errGeneric"));
        return;
      }
      setResult({
        sent: data?.sent ?? 0,
        failed: data?.failed ?? 0,
        skipped: data?.skipped ?? 0,
      });
    } catch {
      setErr(t("groupEmail.errGeneric"));
    } finally {
      setSending(false);
    }
  }

  const segLabel: Record<StatusGroup, string> = {
    team: t("groupEmail.segTeam"),
    client: t("groupEmail.segClient"),
    prospect: t("groupEmail.segProspect"),
    inactive: t("groupEmail.segInactive"),
  };

  // Rând de etichetă cu buton opțional „+ nume" care inserează tokenul
  // pentru prenume la poziția cursorului în câmpul respectiv.
  const fieldLabel = (text: string, onInsert?: () => void) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
      <label style={{ ...labelStyle, marginBottom: 0 }}>{text}</label>
      {onInsert && (
        <button
          type="button"
          onClick={onInsert}
          title={t("groupEmail.insertNameHint")}
          style={{
            border: `1px solid ${C.sage}`,
            background: C.sageLight,
            color: C.sageDark,
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <i className="ti ti-user-plus" style={{ fontSize: 12 }} />
          {t("groupEmail.insertName")}
        </button>
      )}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,53,48,0.45)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: 18,
          width: "100%",
          maxWidth: 940,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 70px rgba(61,53,48,0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.espresso, display: "flex", alignItems: "center", gap: 8 }}>
              <i className={`ti ${lockContact ? "ti-mail-fast" : "ti-users-group"}`} style={{ fontSize: 19, color: C.sage }} />
              {lockContact ? t("groupEmail.titleSingle") : t("groupEmail.title")}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              {lockContact ? t("groupEmail.introSingle") : t("groupEmail.intro")}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, lineHeight: 1, padding: 4 }}
            aria-label="close"
          >
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        {result ? (
          // ── REZULTAT ──
          <div style={{ padding: "40px 28px", textAlign: "center", overflowY: "auto" }}>
            <i className="ti ti-circle-check-filled" style={{ fontSize: 52, color: C.green, display: "block", marginBottom: 14 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: C.espresso, marginBottom: 18 }}>
              {t("groupEmail.resultTitle")}
            </div>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 8, textAlign: "left", color: C.warm, fontSize: 14 }}>
              <div><strong style={{ color: C.green }}>●</strong> {t("groupEmail.resultSent", { count: result.sent })}</div>
              {result.failed > 0 && <div><strong style={{ color: C.red }}>●</strong> {t("groupEmail.resultFailed", { count: result.failed })}</div>}
              {result.skipped > 0 && <div><strong style={{ color: C.muted }}>●</strong> {t("groupEmail.resultSkipped", { count: result.skipped })}</div>}
            </div>
            <div style={{ marginTop: 26 }}>
              <button
                onClick={onClose}
                style={{ background: C.sage, border: "none", borderRadius: 10, padding: "11px 28px", color: "white", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {t("groupEmail.resultClose")}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", overflowY: "auto", flex: 1 }}>
            {/* ── COMPOSER ── */}
            <div style={{ flex: "1 1 360px", minWidth: 300, padding: "20px 22px", borderRight: `1px solid ${C.border}` }}>
              {/* Audience */}
              {lockContact ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{t("groupEmail.toLabel")}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: C.sageLight, border: `1px solid ${C.sage}`, borderRadius: 10 }}>
                    <i className="ti ti-user-circle" style={{ fontSize: 20, color: C.sageDark }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.espresso, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {lockContact.name || lockContact.email}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.warm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {lockContact.email}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <label style={labelStyle}>{t("groupEmail.audienceLabel")}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
                    {/* „Toți" = bifează/debifează toate categoriile */}
                    <button
                      onClick={() => setSelectedSegs(allSelected ? [] : ALL_SEGS)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: `1px solid ${allSelected ? C.sage : C.border}`,
                        background: allSelected ? C.sage : C.white,
                        color: allSelected ? "white" : C.warm,
                        fontSize: 12.5,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <i className={`ti ${allSelected ? "ti-checks" : "ti-square"}`} style={{ fontSize: 14 }} />
                      {t("groupEmail.segAll")}
                    </button>
                    {ALL_SEGS.map((s) => {
                      const active = selectedSegs.includes(s);
                      const n = countFor(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleSeg(s)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: `1px solid ${active ? C.sage : C.border}`,
                            background: active ? C.sage : C.white,
                            color: active ? "white" : C.warm,
                            fontSize: 12.5,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <i className={`ti ${active ? "ti-square-check-filled" : "ti-square"}`} style={{ fontSize: 14 }} />
                          {segLabel[s]}
                          <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>{n}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: recipients.length ? C.sage : C.red, fontWeight: 600, marginBottom: 4 }}>
                    {t("groupEmail.recipientsCount", { count: recipients.length })}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.45 }}>
                    {recipients.length ? t("groupEmail.recipientsHint") : t("groupEmail.noRecipients")}
                  </div>
                </>
              )}

              {/* Language */}
              <label style={labelStyle}>{t("groupEmail.langLabel")}</label>
              <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
                {(["ro", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      border: `1px solid ${lang === l ? C.sage : C.border}`,
                      background: lang === l ? C.sageLight : C.white,
                      color: lang === l ? C.sageDark : C.warm,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Subject */}
              {fieldLabel(t("groupEmail.subjectLabel"), () =>
                insertAtCursor(subjectRef.current, subject, setSubject, nameToken),
              )}
              <input
                ref={subjectRef}
                value={subject}
                maxLength={MAX_SUBJECT}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("groupEmail.subjectPlaceholder")}
                style={{ ...inputStyle, marginBottom: 16 }}
              />

              {/* Email title */}
              {fieldLabel(t("groupEmail.emailTitleLabel"), () =>
                insertAtCursor(titleRef.current, emailTitle, setEmailTitle, nameToken),
              )}
              <input
                ref={titleRef}
                value={emailTitle}
                maxLength={120}
                onChange={(e) => setEmailTitle(e.target.value)}
                placeholder={t("groupEmail.emailTitlePlaceholder")}
                style={{ ...inputStyle, marginBottom: 16 }}
              />

              {/* Message */}
              {fieldLabel(t("groupEmail.messageLabel"), () =>
                insertAtCursor(bodyRef.current, body, setBody, nameToken),
              )}
              <textarea
                ref={bodyRef}
                value={body}
                maxLength={MAX_BODY}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("groupEmail.messagePlaceholder")}
                rows={5}
                style={{ ...inputStyle, minHeight: 110, resize: "vertical", lineHeight: 1.6, marginBottom: 4 }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.45 }}>
                <i className="ti ti-sparkles" style={{ marginRight: 4 }} />
                {t("groupEmail.personalizeHint")}
              </div>

              {/* Image */}
              <label style={labelStyle}>{t("groupEmail.imageLabel")}</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              {imageUrl ? (
                <div style={{ marginBottom: 6 }}>
                  <img src={imageUrl} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}`, display: "block" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => fileRef.current?.click()} disabled={imageUploading} style={smallBtn(false)}>
                      {t("groupEmail.imageChange")}
                    </button>
                    <button onClick={() => setImageUrl(null)} style={smallBtn(true)}>
                      {t("groupEmail.imageRemove")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={imageUploading}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 10,
                    border: `1.5px dashed ${C.border}`,
                    background: C.cream,
                    color: C.warm,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: imageUploading ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <i className={imageUploading ? "ti ti-loader-2" : "ti ti-photo-plus"} style={{ fontSize: 18 }} />
                  {imageUploading ? t("groupEmail.imageUploading") : t("groupEmail.imageAdd")}
                </button>
              )}
              {imageErr && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{imageErr}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, marginBottom: 16, lineHeight: 1.45 }}>
                {t("groupEmail.imageHint")}
              </div>

              {/* CTA */}
              <label style={labelStyle}>{t("groupEmail.ctaSection")}</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder={t("groupEmail.ctaTextPlaceholder")}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder={t("groupEmail.ctaUrlPlaceholder")}
                  style={{ ...inputStyle, flex: 1.4 }}
                />
              </div>
            </div>

            {/* ── PREVIEW ── */}
            <div style={{ flex: "1 1 360px", minWidth: 300, padding: "20px 22px", background: "#F2F5F0" }}>
              <label style={labelStyle}>{t("groupEmail.previewLabel")}</label>
              <iframe
                title="preview"
                sandbox=""
                srcDoc={previewHtml}
                style={{ width: "100%", height: 520, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff" }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {!result && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 22px", flexShrink: 0 }}>
            {err && (
              <div style={{ background: C.redLight, border: `0.5px solid ${C.red}`, borderRadius: 9, padding: "9px 12px", color: C.red, fontSize: 12.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: 15 }} />
                {err}
              </div>
            )}
            {testMsg && (
              <div style={{ background: testMsg.ok ? C.greenLight : C.redLight, border: `0.5px solid ${testMsg.ok ? C.green : C.red}`, borderRadius: 9, padding: "9px 12px", color: testMsg.ok ? C.green : C.red, fontSize: 12.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
                <i className={testMsg.ok ? "ti ti-circle-check" : "ti ti-alert-triangle"} style={{ fontSize: 15 }} />
                {testMsg.text}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={doTest}
                disabled={testing || sending}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 16px", color: C.warm, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: testing ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                <i className="ti ti-send" style={{ fontSize: 15 }} />
                {testing ? t("groupEmail.testSending") : t("groupEmail.testButton")}
              </button>
              <button
                onClick={askSend}
                disabled={sending || testing || recipients.length === 0}
                style={{
                  background: recipients.length === 0 ? C.muted : C.sage,
                  border: "none",
                  borderRadius: 9,
                  padding: "10px 22px",
                  color: "white",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: sending || recipients.length === 0 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <i className="ti ti-mail-fast" style={{ fontSize: 16 }} />
                {sending ? t("groupEmail.sending") : t("groupEmail.sendButton", { count: recipients.length })}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── CONFIRM OVERLAY ── */}
      {confirming && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, background: "rgba(61,53,48,0.5)", zIndex: 10002, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: C.white, borderRadius: 16, padding: "26px 24px", maxWidth: 380, textAlign: "center", boxShadow: "0 20px 60px rgba(61,53,48,0.35)" }}>
            <i className="ti ti-mail-fast" style={{ fontSize: 38, color: C.sage, display: "block", marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: C.espresso, marginBottom: 8 }}>{t("groupEmail.confirmTitle")}</div>
            <div style={{ fontSize: 13.5, color: C.warm, lineHeight: 1.5, marginBottom: 22 }}>
              {t("groupEmail.confirmText", { count: recipients.length })}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: C.linen, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 11, color: C.espresso, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {t("groupEmail.cancel")}
              </button>
              <button onClick={doSend} style={{ flex: 1.4, background: C.sage, border: "none", borderRadius: 10, padding: 11, color: "white", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {t("groupEmail.confirmSend")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function smallBtn(danger: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${danger ? "#E5B3AE" : "#EDE8E0"}`,
    background: danger ? "#FCEDEC" : "#FFFFFF",
    color: danger ? "#9B3A32" : "#6A5A50",
    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  };
}
