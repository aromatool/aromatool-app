import { useState, useEffect } from "react";

const C = {
  primary: "#7B5EA7",
  dark: "#2D1A4E",
  muted: "#9B80C4",
  border2: "rgba(196,168,232,0.5)",
  bg2: "#F5F0FF",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  card: "#FFFFFF",
};

interface EnrollLinkProps {
  clientName?: string;
  clientPhone?: string;
  compact?: boolean;
  onLinkGenerated?: (link: string) => void;
}

export default function EnrollLink({
  clientName,
  clientPhone,
  compact = false,
  onLinkGenerated,
}: EnrollLinkProps) {
  const [sponsorId, setSponsorId] = useState("");
  const [enrollerId, setEnrollerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [countryCode, setCountryCode] = useState("RO");
  const [culture, setCulture] = useState("ro-RO");

  const enrollLink = sponsorId
    ? `https://www.youngliving.com/vo/#/signup/new-start?sponsorid=${sponsorId}&enrollerid=${enrollerId || sponsorId}&isocountrycode=${countryCode}&culture=${culture}&type=member`
    : "";

  // Notify parent when link changes
  useEffect(() => {
    if (onLinkGenerated) onLinkGenerated(enrollLink);
  }, [enrollLink]);

  function copyLink() {
    if (!enrollLink) return;
    navigator.clipboard.writeText(enrollLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function sendWhatsApp() {
    if (!enrollLink || !clientPhone) return;
    const waNum = clientPhone.replace(/[^0-9]/g, "").replace(/^0/, "40");
    const name = clientName ? `Bună ${clientName}! 🌿` : "Bună! 🌿";
    const msg = `${name}\n\nIată linkul tău de înscriere Young Living:\n${enrollLink}\n\nPrin acest link te înscrii direct în echipa mea. Dacă ai întrebări, scrie-mi!`;
    window.open(
      `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  if (compact) {
    // Compact version for cart
    return (
      <div style={{ marginBottom: "8px" }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: "100%",
            background: C.bg2,
            border: `1px solid ${C.border2}`,
            borderRadius: "10px",
            padding: "10px",
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          🔗 {isOpen ? "Ascunde link înscriere" : "Generează link înscriere YL"}
        </button>

        {isOpen && (
          <div
            style={{
              background: C.card,
              border: `1.5px dashed ${C.border2}`,
              borderRadius: "10px",
              padding: "14px",
              marginTop: "6px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: C.muted,
                marginBottom: "10px",
                lineHeight: 1.5,
              }}
            >
              Completează ID-urile sub care vrei să înscrii clientul
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Sponsor ID</label>
                <input
                  value={sponsorId}
                  onChange={(e) =>
                    setSponsorId(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="ex: 16666525"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Enroller ID</label>
                <input
                  value={enrollerId}
                  onChange={(e) =>
                    setEnrollerId(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="ex: 16666525"
                  style={inputStyle}
                />
                <div
                  style={{ fontSize: "10px", color: C.muted, marginTop: "2px" }}
                >
                  Gol = același cu Sponsor ID
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Țara</label>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    const cultures: Record<string, string> = {
                      RO: "ro-RO",
                      DE: "de-DE",
                      FR: "fr-FR",
                      GB: "en-GB",
                      US: "en-US",
                    };
                    setCulture(cultures[e.target.value] || "ro-RO");
                  }}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="RO">🇷🇴 România</option>
                  <option value="DE">🇩🇪 Germania</option>
                  <option value="FR">🇫🇷 Franța</option>
                  <option value="GB">🇬🇧 UK</option>
                  <option value="US">🇺🇸 SUA</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Limba</label>
                <select
                  value={culture}
                  onChange={(e) => setCulture(e.target.value)}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="ro-RO">Română</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="de-DE">Deutsch</option>
                  <option value="fr-FR">Français</option>
                </select>
              </div>
            </div>

            {enrollLink && (
              <>
                <div
                  style={{
                    background: C.bg2,
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    color: C.muted,
                    wordBreak: "break-all",
                    marginBottom: "8px",
                    lineHeight: 1.5,
                  }}
                >
                  {enrollLink}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={copyLink}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: copied ? C.greenbg : C.bg2,
                      border: `1px solid ${copied ? C.green : C.border2}`,
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: copied ? C.green : C.dark,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "✅ Copiat!" : "📋 Copiază"}
                  </button>

                  {clientPhone && (
                    <button
                      onClick={sendWhatsApp}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: "#25D366",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "white",
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      💬 WhatsApp
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full version for contacts page
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border2}`,
        borderRadius: "12px",
        padding: "16px",
        marginTop: "10px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: C.primary,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "12px",
        }}
      >
        🔗 Link înscriere Young Living
      </div>

      <div
        style={{
          fontSize: "12px",
          color: C.muted,
          marginBottom: "12px",
          lineHeight: 1.5,
        }}
      >
        Setează ID-urile sub care vrei să înscrii
        {clientName ? ` pe ${clientName}` : " clientul"} în echipa ta
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <div>
          <label style={labelStyle}>Sponsor ID</label>
          <input
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value.replace(/\D/g, ""))}
            placeholder="ex: 16666525"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Enroller ID</label>
          <input
            value={enrollerId}
            onChange={(e) => setEnrollerId(e.target.value.replace(/\D/g, ""))}
            placeholder="Gol = Sponsor"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Țara</label>
          <select
            value={countryCode}
            onChange={(e) => {
              setCountryCode(e.target.value);
              const cultures: Record<string, string> = {
                RO: "ro-RO",
                DE: "de-DE",
                FR: "fr-FR",
                GB: "en-GB",
                US: "en-US",
              };
              setCulture(cultures[e.target.value] || "ro-RO");
            }}
            style={{ ...inputStyle, appearance: "none" }}
          >
            <option value="RO">🇷🇴 România</option>
            <option value="DE">🇩🇪 Germania</option>
            <option value="FR">🇫🇷 Franța</option>
            <option value="GB">🇬🇧 UK</option>
            <option value="US">🇺🇸 SUA</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Limba</label>
          <select
            value={culture}
            onChange={(e) => setCulture(e.target.value)}
            style={{ ...inputStyle, appearance: "none" }}
          >
            <option value="ro-RO">Română</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="de-DE">Deutsch</option>
            <option value="fr-FR">Français</option>
          </select>
        </div>
      </div>

      {enrollLink ? (
        <>
          <div
            style={{
              background: C.bg2,
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "12px",
              color: C.muted,
              wordBreak: "break-all",
              marginBottom: "10px",
              lineHeight: 1.6,
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: C.primary,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Link generat
            </div>
            {enrollLink}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={copyLink}
              style={{
                flex: 1,
                padding: "9px",
                background: copied ? C.greenbg : C.bg2,
                border: `1px solid ${copied ? C.green : C.border2}`,
                borderRadius: "9px",
                fontSize: "13px",
                color: copied ? C.green : C.dark,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {copied ? "✅ Copiat!" : "📋 Copiază linkul"}
            </button>

            {clientPhone && (
              <button
                onClick={sendWhatsApp}
                style={{
                  flex: 1,
                  padding: "9px",
                  background: "#25D366",
                  border: "none",
                  borderRadius: "9px",
                  fontSize: "13px",
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                💬 Trimite pe WhatsApp
              </button>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "12px",
            fontSize: "12px",
            color: C.muted,
            fontStyle: "italic",
          }}
        >
          Completează Sponsor ID pentru a genera linkul
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: "#6B5B9E",
  marginBottom: "4px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#F9F7FF",
  border: "1.5px solid rgba(196,168,232,0.4)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#2D1A4E",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
