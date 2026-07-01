// ============================================================
// NEWSLETTER / ANUNȚURI — constructor HTML pentru emailurile trimise
// din Admin către PROPRIII useri AromaTool (Brand Partners cu cont).
//
// Diferă de campaignEmail.ts (care e „de la Brand Partner către clienții
// lui", cu semnătură personală): AICI expeditorul e AromaTool (compania),
// deci footer-ul e al companiei, fără semnătură personală.
//
// Personalizare: „__PRENUME__" din salut e înlocuit per destinatar de
// funcția edge (send-broadcast) cu prenumele userului (sau nimic).
// Dezabonarea (link semnat + header List-Unsubscribe) o injectează tot
// funcția edge — aici punem doar linia „de ce primești acest email".
// ============================================================

import { EMAIL_HEADER_HTML } from "./emailLogo";
import { escapeHtml } from "./escapeHtml";
import { applyNameToken } from "./campaignEmail";
import i18n from "../i18n";

export interface BroadcastEmailParams {
  title?: string; // titlu/headline opțional, deasupra mesajului
  body: string; // mesajul principal (text liber, cu rânduri noi)
  imageUrl?: string; // poză inline, sub mesaj
  ctaLabel?: string; // text buton opțional
  ctaUrl?: string; // link buton opțional
  lang?: string; // limba structurii (salut/footer); implicit 'ro'
}

// Text bilingv pentru piesele structurale (nu conținutul, scris de admin).
const TXT = {
  ro: { why: "Primești acest email pentru că ai un cont AromaTool." },
  en: { why: "You're receiving this because you have an AromaTool account." },
} as const;

// URL-uri dintr-un text DEJA escapat → linkuri clicabile (identic cu
// pattern-ul din campaignEmail, aplicat STRICT după escapeHtml).
function linkifyEscaped(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const trailing = url.match(/[.,!?;:)]+$/);
    const clean = trailing ? url.slice(0, -trailing[0].length) : url;
    const tail = trailing ? trailing[0] : "";
    return `<a href="${clean}" style="color:#5C7A5C;text-decoration:underline">${clean}</a>${tail}`;
  });
}

export function buildBroadcastHtml(p: BroadcastEmailParams): string {
  const lng = p.lang === "en" ? "en" : "ro";
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng, ...opts });
  const greeting = t("email.greeting"); // „Bună ziua" / „Hello"

  const titleBlock = p.title && p.title.trim()
    ? `<div style="font-family:Georgia,serif;font-size:20px;color:#3D3530;font-weight:600;line-height:1.35;margin:0 0 14px;text-align:center">${applyNameToken(escapeHtml(p.title))}</div>`
    : "";

  const bodyBlock = p.body && p.body.trim()
    ? `<div style="font-size:14px;color:#3D3530;line-height:1.75;white-space:pre-wrap">${applyNameToken(linkifyEscaped(escapeHtml(p.body)))}</div>`
    : "";

  const imageBlock = p.imageUrl && p.imageUrl.trim()
    ? `<div style="margin:20px 0 4px;text-align:center">
        <img src="${encodeURI(p.imageUrl.trim())}" alt="" width="464" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px;margin:0 auto" />
      </div>`
    : "";

  const ctaBlock = p.ctaLabel && p.ctaLabel.trim() && p.ctaUrl && p.ctaUrl.trim()
    ? `<div style="text-align:center;margin-top:22px">
        <a href="${encodeURI(p.ctaUrl.trim())}" style="display:inline-block;background:linear-gradient(135deg,#6B8E6B,#5C7A5C);border-radius:10px;padding:13px 36px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.03em;box-shadow:0 4px 15px rgba(92,122,92,0.3)">${escapeHtml(p.ctaLabel)}</a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F2F5F0;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DDE6DD;">

  ${EMAIL_HEADER_HTML}

  <div style="padding:28px 28px 24px;">
    <p style="font-size:15px;color:#3D3530;margin:0 0 18px;text-align:center">
      ${greeting}<strong>__PRENUME__</strong>!
    </p>

    ${titleBlock}
    ${bodyBlock}
    ${imageBlock}
    ${ctaBlock}
  </div>

  <div style="background:#FAFAF7;border-top:1px solid #EEF3EE;padding:14px 28px;text-align:center;">
    <span style="font-size:11px;color:#A89888;line-height:1.6">${TXT[lng].why}</span>
  </div>
</div>
</body></html>`;
}
