import { useTranslation } from "react-i18next";

// Numărul de WhatsApp al echipei, în format internațional fără „+".
// (RO: prefix 40 + numărul fără 0 din față → 0746990416 devine 40746990416)
const WHATSAPP_NUMBER = "40746990416";

/**
 * Buton flotant rotund (verde WhatsApp) care deschide direct conversația
 * cu echipa, cu un mesaj pre-completat. Stivuit deasupra butonului „Feedback".
 */
export default function WhatsAppButton() {
  const { t } = useTranslation();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    t("feedback.whatsappMessage")
  )}`;

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-fab"
        title={t("feedback.whatsappTitle")}
        aria-label={t("feedback.whatsappTitle")}
        style={{
          position: "fixed",
          right: "20px",
          bottom: "84px",
          zIndex: 95,
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          background: "#25D366",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(37,211,102,0.45)",
          textDecoration: "none",
        }}
      >
        <i
          className="ti ti-brand-whatsapp"
          style={{ fontSize: "28px", color: "#FFFFFF" }}
        />
      </a>

      <style>{`
        .whatsapp-fab { transition: transform .15s ease, box-shadow .15s ease; }
        .whatsapp-fab:hover {
          transform: scale(1.06);
          box-shadow: 0 6px 18px rgba(37,211,102,0.55);
        }
        @media (max-width: 768px) {
          .whatsapp-fab { bottom: 148px !important; }
        }
      `}</style>
    </>
  );
}
