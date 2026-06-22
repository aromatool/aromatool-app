// ============================================================
// EMAIL „TRIMITE ÎN GRUP" — constructor HTML + text.
//
// Refolosește exact aceleași piese ca emailul de ofertă (antet cu
// logo + footer cu semnătură/contact/disclaimer), ca să arate
// consistent și branded. Conținutul e simplu: un titlu opțional, un
// mesaj liber, o poză inline (sub mesaj) și un buton opțional (CTA).
//
// Personalizare: salutul conține „__PRENUME__", pe care funcția edge
// (send-group-email) îl înlocuiește per destinatar cu prenumele lui
// (sau cu nimic, dacă n-are nume). NU includem aici dezabonarea —
// funcția edge injectează footer-ul + headerele List-Unsubscribe.
// ============================================================

import { EMAIL_HEADER_HTML } from "./emailLogo";
import { buildEmailFooter } from "./emailFooter";
import { escapeHtml } from "./escapeHtml";
import i18n from "../i18n";

export interface CampaignEmailParams {
  title?: string; // titlu/headline opțional, deasupra mesajului
  body: string; // mesajul principal (text liber, cu rânduri noi)
  imageUrl?: string; // poză inline, sub mesaj
  ctaLabel?: string; // text buton opțional
  ctaUrl?: string; // link buton opțional
  userName: string;
  userPhone?: string;
  userEmail?: string;
  userSignature?: string;
  lang?: string; // limba emailului (implicit 'ro')
}

// URL-uri dintr-un text DEJA escapat → linkuri clicabile (identic cu
// pattern-ul din useSendEmail, aplicat STRICT după escapeHtml).
function linkifyEscaped(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const trailing = url.match(/[.,!?;:)]+$/);
    const clean = trailing ? url.slice(0, -trailing[0].length) : url;
    const tail = trailing ? trailing[0] : "";
    return `<a href="${clean}" style="color:#5C7A5C;text-decoration:underline">${clean}</a>${tail}`;
  });
}

export function buildCampaignHtml(p: CampaignEmailParams): string {
  const lng = p.lang || "ro";
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng, ...opts });
  const greeting = t("email.greeting"); // „Bună ziua" / „Hello"

  const titleBlock = p.title && p.title.trim()
    ? `<div style="font-family:Georgia,serif;font-size:20px;color:#3D3530;font-weight:600;line-height:1.35;margin:0 0 14px;text-align:center">${escapeHtml(p.title)}</div>`
    : "";

  const bodyBlock = p.body && p.body.trim()
    ? `<div style="font-size:14px;color:#3D3530;line-height:1.75;white-space:pre-wrap">${linkifyEscaped(escapeHtml(p.body))}</div>`
    : "";

  const imageBlock = p.imageUrl
    ? `<div style="margin:20px 0 4px;text-align:center">
        <img src="${encodeURI(p.imageUrl)}" alt="" width="464" style="display:block;width:100%;max-width:464px;height:auto;border:0;border-radius:12px;margin:0 auto" />
      </div>`
    : "";

  const ctaBlock = p.ctaLabel && p.ctaLabel.trim() && p.ctaUrl && p.ctaUrl.trim()
    ? `<div style="text-align:center;margin-top:22px">
        <a href="${encodeURI(p.ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6B8E6B,#5C7A5C);border-radius:10px;padding:13px 36px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.03em;box-shadow:0 4px 15px rgba(92,122,92,0.3)">${escapeHtml(p.ctaLabel)}</a>
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

  ${buildEmailFooter({
    userName: p.userName,
    userPhone: p.userPhone,
    userEmail: p.userEmail,
    userSignature: p.userSignature,
    lang: lng,
  })}

  <div style="background:#FAFAF7;border-top:1px solid #EEF3EE;padding:12px 28px;text-align:center;">
    <span style="font-size:11px;color:#A89888">${t("email.sentVia")}</span>
  </div>
</div>
</body></html>`;
}

export function buildCampaignText(p: CampaignEmailParams): string {
  const lng = p.lang || "ro";
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng, ...opts });
  const lines: string[] = [];

  lines.push(`${t("email.greeting")}__PRENUME__!`);
  lines.push("");
  if (p.title && p.title.trim()) {
    lines.push(p.title.trim());
    lines.push("");
  }
  if (p.body && p.body.trim()) {
    lines.push(p.body.trim());
  }
  if (p.imageUrl) {
    lines.push("");
    lines.push(`${t("groupEmail.textImage")}: ${p.imageUrl}`);
  }
  if (p.ctaLabel && p.ctaLabel.trim() && p.ctaUrl && p.ctaUrl.trim()) {
    lines.push("");
    lines.push(`${p.ctaLabel.trim()}: ${p.ctaUrl.trim()}`);
  }
  lines.push("");
  lines.push("—");
  const sig = p.userSignature && p.userSignature.trim()
    ? p.userSignature.trim()
    : `${t("email.closing")}${p.userName ? `, ${p.userName}` : ""}`;
  lines.push(sig);
  if (p.userPhone) lines.push(p.userPhone);
  lines.push("");
  lines.push(t("email.independentDisclaimer"));

  return lines.join("\n");
}
