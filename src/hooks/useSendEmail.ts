import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CartItem } from './useCartStore'

interface SendOfferParams {
  clientName: string
  clientEmail: string
  notes: string
  items: CartItem[]
  transport: number
  totalRon: number
  totalEur: number
  exchangeRate: number
  includeGuide?: boolean
}

function fmt(n: number) {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildEmailHtml(params: SendOfferParams, userName: string, userPhone?: string, userEmail?: string): string {
  const { clientName, items, transport, totalRon, totalEur, exchangeRate, notes } = params

  const rows = items.map(item => {
    const priceRon = item.isCustom ? (item.customPriceRon || 0) : item.price_eur * exchangeRate
    const lineTotal = priceRon * item.qty * (1 - item.disc / 100)
    const disc = item.disc > 0 ? `<span style="color:#C94F6A;font-size:11px"> −${item.disc}%</span>` : ''
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#2D1A4E">${item.name}${disc}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#9B80C4;text-align:center">${item.qty}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#4A3270;text-align:right;font-weight:600">${fmt(lineTotal)} RON</td>
    </tr>`
  }).join('')

  const waLink = userPhone ? `https://wa.me/${userPhone.replace(/[^0-9]/g, '').replace(/^0/, '40')}` : ''

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F0FF;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E0D4F8;">

  <div style="background:#4A3270;padding:24px 28px 20px;text-align:center;">
    <svg width="160" height="52" viewBox="0 0 200 65" xmlns="http://www.w3.org/2000/svg">
      <line x1="32" y1="10" x2="88" y2="10" stroke="#C4A8E8" stroke-width="1"/>
      <circle cx="100" cy="10" r="3.5" fill="#C4A8E8"/>
      <line x1="112" y1="10" x2="168" y2="10" stroke="#C4A8E8" stroke-width="1"/>
      <text x="100" y="36" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#ffffff">AromaTool</text>
      <text x="100" y="52" text-anchor="middle" font-family="Georgia,serif" font-size="9" font-style="italic" fill="#C8BFFF" letter-spacing="1.5">crafted for your team</text>
    </svg>
  </div>

  <div style="padding:28px 28px 0;">
    <p style="font-size:15px;color:#4A3270;margin-bottom:6px;text-align:center">
      Bună ziua${clientName ? `, <strong>${clientName}</strong>` : ''}!
    </p>
    <p style="font-size:13px;color:#9B80C4;margin-bottom:24px;text-align:center">
      Oferta de mai jos a fost pregătită special pentru dumneavoastră<br>
      de către <strong style="color:#6B5B9E">${userName}</strong>.
    </p>

    <table style="width:100%;border-collapse:collapse;border:1px solid #E8E0F8;border-radius:10px;overflow:hidden;">
      <thead>
        <tr style="background:#F5F0FF;">
          <th style="padding:10px 16px;font-size:11px;color:#9B80C4;text-align:left;font-weight:500;text-transform:uppercase">Produs</th>
          <th style="padding:10px 16px;font-size:11px;color:#9B80C4;text-align:center;font-weight:500;text-transform:uppercase">Cant.</th>
          <th style="padding:10px 16px;font-size:11px;color:#9B80C4;text-align:right;font-weight:500;text-transform:uppercase">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${transport > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="padding:6px 16px;font-size:13px;color:#9B80C4">🚚 Transport</td>
        <td style="padding:6px 16px;font-size:13px;color:#6B5B9E;text-align:right;font-weight:500">${fmt(transport)} RON</td>
      </tr>
    </table>` : ''}

    <table style="width:100%;border-collapse:collapse;background:#F5F0FF;border-radius:10px;margin-top:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:15px;color:#4A3270">Total de plată</td>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:26px;color:#4A3270;font-weight:600;text-align:right">${fmt(totalRon)} RON</td>
      </tr>
    </table>

    ${notes ? `
    <div style="margin-top:14px;padding:14px 16px;background:#FDFAFF;border-radius:10px;border:1px solid #E8E0F8;">
      <div style="font-size:10px;color:#9B80C4;text-transform:uppercase;letter-spacing:.08em;font-weight:500;margin-bottom:8px">Notițe personalizate</div>
      <div style="font-size:13px;color:#4A3270;line-height:1.7;white-space:pre-wrap">${notes}</div>
    </div>` : ''}
  </div>

  <div style="border-top:1px solid #F0EEFF;padding:20px 28px;text-align:center;">
    <p style="font-size:13px;color:#9B80C4;margin-bottom:16px;line-height:1.6">
      Ai întrebări? Mă bucur să te ajut!
    </p>
    ${userEmail ? `<p style="margin-bottom:8px"><a href="mailto:${userEmail}" style="color:#7B5EA7;text-decoration:none;font-size:13px">${userEmail}</a></p>` : ''}
    ${userPhone ? `<p style="margin-bottom:16px"><a href="${waLink}" style="color:#6B5B9E;text-decoration:none;font-size:13px">${userPhone}</a></p>` : ''}
    ${waLink ? `<a href="${waLink}" style="display:inline-block;background:#25D366;border-radius:8px;padding:10px 28px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:500;text-decoration:none">Scrie-mi pe WhatsApp</a>` : ''}
  </div>

  <div style="background:#F9F7FF;border-top:1px solid #F0EEFF;padding:12px 28px;text-align:center;">
    <span style="font-size:11px;color:#C4A8E8">Trimis prin AromaTool</span>
  </div>

</div>
</body></html>`
}

export function useSendEmail() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { user } = useAuth()

  const sendOffer = async (params: SendOfferParams) => {
    if (!params.clientEmail || !params.clientEmail.includes('@')) {
      setError('Email invalid.')
      return false
    }
    if (params.items.length === 0) {
      setError('Coșul e gol.')
      return false
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'AromaTool'
      const userPhone = user?.user_metadata?.phone || ''
      const userEmail = user?.user_metadata?.contact_email || user?.email || ''

      const subject = params.clientName
        ? `${params.clientName}, iată oferta ta — ${userName}`
        : `Oferta ta — ${userName}`

      const html = buildEmailHtml(params, userName, userPhone, userEmail)

      const { data, error: fnError } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.clientEmail,
          subject,
          html,
        }
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setSuccess(true)
      return true
    } catch (err: any) {
      console.error('Send email error:', err)
      setError(err.message || 'Eroare la trimitere. Încearcă din nou.')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { sendOffer, loading, error, success, setError, setSuccess }
}