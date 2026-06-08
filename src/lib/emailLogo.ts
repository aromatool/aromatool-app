// ============================================================
// LOGO OFICIAL AROMATOOL pentru emailuri.
// Replică lockup-ul din AppLayout (pătrat sage + frunză albă +
// wordmark + tagline), construit cu tabele inline ca să se
// randeze consistent în clienții de email.
// Logo-ul e PNG găzduit (nu SVG) — Gmail elimină SVG inline.
// Folosit identic în toate emailurile (ofertă, follow-up, custom).
// ============================================================

import { EMAIL_ASSET } from './emailAssets'

export const EMAIL_HEADER_HTML = `
  <div style="padding:22px 28px;text-align:center;background:#ffffff;border-bottom:1px solid #EDE8E0;">
    <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td width="42" height="42" valign="middle" align="center">
          <img src="${EMAIL_ASSET.logo}" width="42" height="42" alt="AromaTool" style="display:block;width:42px;height:42px;border:0;border-radius:10px" />
        </td>
        <td style="padding-left:11px;" valign="middle" align="left">
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:20px;font-weight:600;color:#3D3530;letter-spacing:-0.02em;line-height:1.1">AromaTool</div>
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:9px;color:#A89888;letter-spacing:0.08em;margin-top:3px">crafted for your team</div>
        </td>
      </tr>
    </table>
  </div>`
