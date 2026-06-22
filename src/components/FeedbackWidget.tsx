import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import ModalPortal from "./ModalPortal";

const T = {
  sage: "#5C7A5C",
  sageDark: "#4A6A4A",
  sageLight: "#E8F0E8",
  sageMid: "#C8D8C8",
  cream: "#FAFAF7",
  espresso: "#3D3530",
  warm: "#6A5A50",
  muted: "#A89888",
  border: "#EDE8E0",
  white: "#FFFFFF",
  green: "#2E8A58",
  greenLight: "#E8F8F0",
};

// Numărul de WhatsApp al echipei, în format internațional fără „+".
// (RO: prefix 40 + numărul fără 0 din față → 0746990416 devine 40746990416)
const WHATSAPP_NUMBER = "40746990416";

const TYPES: { key: string; icon: string }[] = [
  { key: "sugestie", icon: "ti-bulb" },
  { key: "problema", icon: "ti-alert-triangle" },
  { key: "altele", icon: "ti-message" },
];

export default function FeedbackWidget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("sugestie");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setType("sugestie");
    setMessage("");
    setSent(false);
    setError("");
  };

  const close = () => {
    setOpen(false);
    // mic delay ca să nu „sară” conținutul în timpul animației de închidere
    setTimeout(reset, 200);
  };

  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    t("feedback.whatsappMessage")
  )}`;

  async function submit() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    const { error: insErr } = await supabase.from("feedback").insert({
      user_id: user?.id,
      type,
      message: message.trim(),
      page: location.pathname,
      user_email: user?.email ?? null,
    });
    setSending(false);
    if (insErr) {
      setError(t("feedback.sendError"));
      return;
    }
    setSent(true);
  }

  return (
    <>
      {/* Buton flotant */}
      <button
        onClick={() => setOpen(true)}
        className="feedback-fab"
        title={t("feedback.fabTitle")}
        style={{
          position: "fixed",
          right: "20px",
          bottom: "24px",
          zIndex: 95,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: T.white,
          border: `1px solid ${T.sageMid}`,
          borderRadius: "999px",
          padding: "10px 16px",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "13px",
          fontWeight: 500,
          color: T.sageDark,
          boxShadow: "0 4px 14px rgba(60,53,48,0.14)",
        }}
      >
        <i className="ti ti-message-2-heart" style={{ fontSize: "17px" }} />
        <span className="feedback-fab-label">{t("feedback.fabLabel")}</span>
      </button>

      {/* Modal */}
      {open && (
        <ModalPortal>
        <div
          onClick={close}
          className="am-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(61,53,48,0.4)",
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="am-modal-card"
            style={{
              width: "100%",
              maxWidth: "440px",
              background: T.white,
              borderRadius: "18px",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(60,53,48,0.25)",
            }}
          >
            {sent ? (
              <div style={{ padding: "36px 28px", textAlign: "center" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: T.greenLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                  }}
                >
                  <i
                    className="ti ti-check"
                    style={{ fontSize: "28px", color: T.green }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: 600,
                    color: T.espresso,
                    marginBottom: "6px",
                  }}
                >
                  {t("feedback.thanks")}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: T.muted,
                    marginBottom: "20px",
                    lineHeight: 1.6,
                  }}
                >
                  {t("feedback.thanksBody")}
                </div>
                <button
                  onClick={close}
                  style={{
                    padding: "10px 22px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    background: T.sage,
                    border: "none",
                    borderRadius: "10px",
                    color: T.white,
                    cursor: "pointer",
                  }}
                >
                  {t("feedback.close")}
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  style={{
                    padding: "18px 24px",
                    borderBottom: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: T.espresso,
                      }}
                    >
                      {t("feedback.title")}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: T.muted,
                        marginTop: "2px",
                      }}
                    >
                      {t("feedback.subtitle")}
                    </div>
                  </div>
                  <button
                    onClick={close}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: T.muted,
                      padding: "4px",
                    }}
                  >
                    <i className="ti ti-x" style={{ fontSize: "20px" }} />
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px" }}>
                  {/* Tip */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    {TYPES.map((tp) => {
                      const active = type === tp.key;
                      return (
                        <button
                          key={tp.key}
                          onClick={() => setType(tp.key)}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "4px",
                            padding: "10px 6px",
                            background: active ? T.sageLight : T.white,
                            border: `1px solid ${active ? T.sageMid : T.border}`,
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            color: active ? T.sageDark : T.muted,
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          <i className={`ti ${tp.icon}`} style={{ fontSize: "18px" }} />
                          {t(`feedback.types.${tp.key}`)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mesaj */}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    autoFocus
                    placeholder={t("feedback.placeholder")}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      background: T.cream,
                      border: `1px solid ${T.border}`,
                      borderRadius: "10px",
                      fontSize: "14px",
                      color: T.espresso,
                      fontFamily: "inherit",
                      lineHeight: 1.6,
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />

                  {error && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#C94F6A",
                        marginTop: "8px",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  {/* Contact direct prin WhatsApp */}
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginTop: "16px",
                      display: "flex",
                      alignItems: "center",
                      gap: "11px",
                      padding: "11px 14px",
                      background: T.greenLight,
                      border: `1px solid ${T.sageMid}`,
                      borderRadius: "10px",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#25D366",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="ti ti-brand-whatsapp"
                        style={{ fontSize: "19px", color: "#FFFFFF" }}
                      />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: T.espresso,
                        }}
                      >
                        {t("feedback.whatsappTitle")}
                      </span>
                      <span style={{ fontSize: "11.5px", color: T.muted }}>
                        {t("feedback.whatsappPrompt")}
                      </span>
                    </span>
                    <i
                      className="ti ti-external-link"
                      style={{
                        marginLeft: "auto",
                        fontSize: "16px",
                        color: T.muted,
                      }}
                    />
                  </a>
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: "0 24px 20px",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={close}
                    style={{
                      padding: "10px 18px",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      background: T.white,
                      border: `1px solid ${T.border}`,
                      borderRadius: "10px",
                      color: T.warm,
                      cursor: "pointer",
                    }}
                  >
                    {t("feedback.cancel")}
                  </button>
                  <button
                    onClick={submit}
                    disabled={!message.trim() || sending}
                    style={{
                      padding: "10px 20px",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      fontWeight: 500,
                      background:
                        !message.trim() || sending ? T.sageMid : T.sage,
                      border: "none",
                      borderRadius: "10px",
                      color: T.white,
                      cursor:
                        !message.trim() || sending ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {sending ? t("feedback.sending") : t("feedback.send")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      <style>{`
        @media (max-width: 768px) {
          .feedback-fab {
            bottom: 84px !important;
            padding: 11px !important;
          }
          .feedback-fab-label { display: none !important; }
        }
      `}</style>
    </>
  );
}
