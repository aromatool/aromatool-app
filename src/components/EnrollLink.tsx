import { useState, useEffect } from "react";

const C = {
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  border2: "rgba(92,122,92,0.25)",
  bg2: "#EEF3EE",
  green: "#2E8A58",
  greenbg: "#E8F8F0",
  card: "#FFFFFF",
};

const CULTURES: Record<string, string> = {
  RO: "ro-RO",
  DE: "de-DE",
  FR: "fr-FR",
  GB: "en-GB",
  US: "en-US",
};

interface EnrollLinkProps {
  clientName?: string;
  clientPhone?: string;
  compact?: boolean;
  onLinkGenerated?: (link: string) => void;
  // Țara catalogului ofertei — inițializează țara/limba linkului de înscriere.
  country?: string;
}

export default function EnrollLink({
  clientName,
  clientPhone,
  compact = false,
  onLinkGenerated,
  country,
}: EnrollLinkProps) {
  const [sponsorId, setSponsorId] = useState("");
  const [enrollerId, setEnrollerId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const [countryCode, setCountryCode] = useState(country || "RO");
  const [culture, setCulture] = useState(CULTURES[country || "RO"] || "ro-RO");

  // Când oferta schimbă catalogul (țara), aliniem implicit țara/limba linkului.
  useEffect(() => {
    if (!country) return;
    setCountryCode(country);
    setCulture(CULTURES[country] || "ro-RO");
  }, [country]);

  const enrollLink = sponsorId
    ? `https://www.youngliving.com/vo/#/signup/new-start?sponsorid=${sponsorId}&enrollerid=${enrollerId || sponsorId}&isocountrycode=${countryCode}&culture=${culture}&type=member`
    : "";

  // Dacă utilizatorul modifică datele după ce a salvat, invalidăm linkul
  // salvat și îl scoatem din email până la o nouă salvare.
  useEffect(() => {
    if (saved) {
      setSaved(false);
      if (onLinkGenerated) onLinkGenerated("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId, enrollerId, countryCode, culture]);

  function saveLink() {
    if (!enrollLink) return;
    if (onLinkGenerated) onLinkGenerated(enrollLink);
    setSaved(true);
  }

  function removeLink() {
    if (onLinkGenerated) onLinkGenerated("");
    setSaved(false);
  }

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
            background: saved ? C.greenbg : isOpen ? C.bg2 : C.card,
            border: `1px solid ${saved ? C.green : C.border2}`,
            borderRadius: "10px",
            padding: "11px",
            color: saved ? C.green : C.primary,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
          }}
        >
          <i
            className={saved ? "ti ti-circle-check" : "ti ti-link"}
            style={{ fontSize: "15px" }}
          />
          {isOpen
            ? "Ascunde link înscriere"
            : saved
              ? "Link înscriere adăugat"
              : "Adaugă link înscriere"}
          <i
            className={isOpen ? "ti ti-chevron-up" : "ti ti-chevron-down"}
            style={{ fontSize: "14px", marginLeft: "auto", opacity: 0.6 }}
          />
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
                    setCulture(CULTURES[e.target.value] || "ro-RO");
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
                    fontSize: "10px",
                    fontWeight: 600,
                    color: C.primary,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "5px",
                  }}
                >
                  Link generat — previzualizare
                </div>
                <div
                  style={{
                    background: C.bg2,
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    color: C.muted,
                    wordBreak: "break-all",
                    marginBottom: "10px",
                    lineHeight: 1.5,
                  }}
                >
                  {enrollLink}
                </div>

                {/* Salvează linkul în email */}
                {saved ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: C.greenbg,
                      border: `1px solid ${C.green}`,
                      borderRadius: "9px",
                      padding: "9px 11px",
                      marginBottom: "8px",
                    }}
                  >
                    <i
                      className="ti ti-circle-check"
                      style={{ fontSize: "16px", color: C.green }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: "12px",
                        fontWeight: 600,
                        color: C.green,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      Linkul va fi inclus în email
                    </span>
                    <button
                      onClick={removeLink}
                      style={{
                        background: "none",
                        border: "none",
                        color: C.muted,
                        fontSize: "11px",
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Scoate
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={saveLink}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: C.primary,
                      border: "none",
                      borderRadius: "9px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "white",
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      marginBottom: "8px",
                    }}
                  >
                    <i className="ti ti-plus" style={{ fontSize: "15px" }} />
                    Adaugă linkul în email
                  </button>
                )}

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={copyLink}
                    style={{
                      flex: 1,
                      padding: "9px",
                      background: copied ? C.greenbg : C.bg2,
                      border: `1px solid ${copied ? C.green : C.border2}`,
                      borderRadius: "9px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: copied ? C.green : C.dark,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <i className={copied ? "ti ti-check" : "ti ti-copy"} style={{ fontSize: "14px" }} />
                    {copied ? "Copiat!" : "Copiază"}
                  </button>

                  {clientPhone && (
                    <button
                      onClick={sendWhatsApp}
                      style={{
                        flex: 1,
                        padding: "9px",
                        background: C.card,
                        border: `1px solid ${C.border2}`,
                        borderRadius: "9px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#25A85A",
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#25A85A">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.851L.057 23.928l6.231-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.983 0-3.83-.543-5.41-1.485l-.387-.23-4.015 1.053 1.072-3.916-.251-.4A9.788 9.788 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182c5.422 0 9.818 4.396 9.818 9.818 0 5.422-4.396 9.818-9.818 9.818z"/>
                      </svg>
                      WhatsApp
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
                padding: "10px",
                background: copied ? C.greenbg : C.bg2,
                border: `1px solid ${copied ? C.green : C.border2}`,
                borderRadius: "9px",
                fontSize: "13px",
                color: copied ? C.green : C.dark,
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <i className={copied ? "ti ti-check" : "ti ti-copy"} style={{ fontSize: "15px" }} />
              {copied ? "Copiat!" : "Copiază linkul"}
            </button>

            {clientPhone && (
              <button
                onClick={sendWhatsApp}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#25D366",
                  border: "none",
                  borderRadius: "9px",
                  fontSize: "13px",
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(37,211,102,0.28)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.851L.057 23.928l6.231-1.635A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.983 0-3.83-.543-5.41-1.485l-.387-.23-4.015 1.053 1.072-3.916-.251-.4A9.788 9.788 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182c5.422 0 9.818 4.396 9.818 9.818 0 5.422-4.396 9.818-9.818 9.818z"/>
                </svg>
                Trimite pe WhatsApp
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
  color: "#6A5A50",
  marginBottom: "4px",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "#F8FAF8",
  border: "1.5px solid rgba(92,122,92,0.25)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#3D3530",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};
