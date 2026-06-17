// ============================================================
// FOOTER EMAIL — semnătură + contact discret.
// O mică secțiune de contact, integrată în temă: numărul de
// telefon vizibil + iconițe rotunde fine (WhatsApp, Email) în
// tonuri de sage, nu verde strident. Compact, aerisit, elegant.
// Folosit identic în toate emailurile (ofertă, follow-up, custom).
// ============================================================

import { EMAIL_ASSET } from './emailAssets'
import i18n from '../i18n'

interface FooterOpts {
  userName?: string
  userPhone?: string
  userEmail?: string
  userSignature?: string
  lang?: string   // limba emailului (implicit 'ro')
}

// +40 normalizat pentru wa.me (RO: 07xx → 407xx).
function waDigits(phone?: string): string {
  return phone ? phone.replace(/[^0-9]/g, '').replace(/^0/, '40') : ''
}

// Semnătură liberă → HTML sigur (fără tag-uri, \n → <br>).
function sigToHtml(sig?: string): string {
  if (!sig || !sig.trim()) return ''
  return sig.trim().replace(/[<>]/g, '').replace(/\n/g, '<br>')
}

// Iconiță rotundă fină (PNG găzduit, nu SVG — Gmail elimină SVG).
// Cercul sage e deja inclus în PNG, deci doar afișăm imaginea.
function iconLink(href: string, src: string, label: string): string {
  return `<a href="${href}" title="${label}" style="display:inline-block;text-decoration:none;margin:0 4px"><img src="${src}" width="34" height="34" alt="${label}" style="display:block;width:34px;height:34px;border:0" /></a>`
}

const PHONE_IMG = `<img src="${EMAIL_ASSET.phone}" width="15" height="15" alt="" style="display:inline-block;width:15px;height:15px;border:0;vertical-align:middle;margin-right:6px" />`

export function buildEmailFooter(opts: FooterOpts): string {
  const { userName = '', userPhone, userEmail, userSignature, lang = 'ro' } = opts
  const digits = waDigits(userPhone)
  const sig = sigToHtml(userSignature)
  const closing = i18n.t('email.closing', { lng: lang })
  const disclaimer = i18n.t('email.independentDisclaimer', { lng: lang })
  const closingQuestions = i18n.t('email.closingQuestions', { lng: lang })
  const closingWarm = i18n.t('email.closingWarm', { lng: lang })

  // Celule de contact, toate aliniate vertical la mijloc printr-un tabel.
  const cells: string[] = []
  if (userPhone) {
    cells.push(
      `<td valign="middle" style="vertical-align:middle;padding:0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:600;color:#5C7A5C;white-space:nowrap">${PHONE_IMG}${userPhone}</td>`,
    )
  }
  if (digits) {
    cells.push(
      `<td valign="middle" style="vertical-align:middle">${iconLink(`https://wa.me/${digits}`, EMAIL_ASSET.wa, 'WhatsApp')}</td>`,
    )
  }
  if (userEmail) {
    cells.push(
      `<td valign="middle" style="vertical-align:middle">${iconLink(`mailto:${userEmail}`, EMAIL_ASSET.mail, 'Email')}</td>`,
    )
  }

  const contactRow = cells.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 0"><tr>${cells.join('')}</tr></table>`
    : ''

  const sigBlock = sig
    ? `<p style="font-size:13px;color:#6A5A50;margin:0 0 12px;line-height:1.7;font-family:'Helvetica Neue',Arial,sans-serif">${sig}</p>`
    : `<p style="font-size:13px;color:#6A5A50;margin:0 0 12px;line-height:1.6;font-family:'Helvetica Neue',Arial,sans-serif">${closing}${userName ? `, <strong style="color:#4A6A4A">${userName}</strong>` : ''}</p>`

  const disclaimerRow = `<p style="font-size:11px;color:#A89C90;margin:14px 0 0;line-height:1.5;font-family:'Helvetica Neue',Arial,sans-serif">${disclaimer}</p>`

  // Încheiere standard, deasupra liniei despărțitoare — apare în toate
  // emailurile către client (ofertă, follow-up, mesaj custom), o singură dată.
  const closingRow = `<p style="font-size:13px;color:#6A5A50;margin:0;padding:4px 28px 18px;line-height:1.7;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif">${closingQuestions}<br><br>${closingWarm}</p>`

  return `${closingRow}
  <div style="border-top:1px solid #EDE8E0;padding:20px 28px;text-align:center;">
    ${sigBlock}
    ${contactRow}
    ${disclaimerRow}
  </div>`
}
