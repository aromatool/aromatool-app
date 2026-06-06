import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CartItem } from './useCartStore'

interface SendOfferParams {
  clientName: string
  clientEmail: string
  clientPhone?: string
  contactId?: string
  notes: string
  items: CartItem[]
  transport: number       // in EUR
  totalDisplay: number        // total in display currency
  totalEur: number        // total in EUR
  exchangeRate: number    // EUR → display currency rate
  currency: string        // display currency code
  includeGuide?: boolean
  enrollLink?: string
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  RON: 'RON', EUR: '€', USD: '$', GBP: '£',
  CHF: 'CHF', HUF: 'Ft', PLN: 'zł', CZK: 'Kč',
}

function fmtCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  const formatted = amount.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (['USD', 'GBP'].includes(currency)) return `${symbol}${formatted}`
  return `${formatted} ${symbol}`
}


function buildEmailHtml(params: SendOfferParams, userName: string, userPhone?: string, userEmail?: string): string {
  const { clientName, items, transport, totalDisplay, totalEur, exchangeRate, currency, notes, enrollLink } = params
  const displayCurrency = currency || 'RON'
  const rate = exchangeRate || 5.2523

  const rows = items.map(item => {
    const priceEur = item.price_eur
    const lineTotalEur = priceEur * item.qty * (1 - item.disc / 100)
    const lineTotalDisplay = lineTotalEur * rate
    const disc = item.disc > 0 ? `<span style="color:#C94F6A;font-size:11px"> −${item.disc}%</span>` : ''
    const secondaryEur = displayCurrency !== 'EUR' ? `<div style="font-size:11px;color:#C4A8E8;margin-top:2px">€ ${lineTotalEur.toFixed(2)}</div>` : ''
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#2D1A4E">${item.name}${disc}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#9B80C4;text-align:center">${item.qty}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #F0EEFF;font-size:14px;color:#4A3270;text-align:right;font-weight:600">
        ${fmtCurrency(lineTotalDisplay, displayCurrency)}${secondaryEur}
      </td>
    </tr>`
  }).join('')

  const transportDisplay = transport * rate
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
        <td style="padding:6px 16px;font-size:13px;color:#6B5B9E;text-align:right;font-weight:500">
          ${fmtCurrency(transportDisplay, displayCurrency)}
          ${displayCurrency !== 'EUR' ? `<span style="font-size:11px;color:#C4A8E8;margin-left:6px">€ ${transport.toFixed(2)}</span>` : ''}
        </td>
      </tr>
    </table>` : ''}

    <table style="width:100%;border-collapse:collapse;background:#F5F0FF;border-radius:10px;margin-top:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:15px;color:#4A3270">Total de plată</td>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:26px;color:#4A3270;font-weight:600;text-align:right">
          ${fmtCurrency(totalDisplay, displayCurrency)}
          ${displayCurrency !== 'EUR' ? `<div style="font-size:13px;color:#9B80C4;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400">€ ${totalEur.toFixed(2)}</div>` : ''}
        </td>
      </tr>
    </table>

    ${notes ? `
    <div style="margin-top:14px;padding:14px 16px;background:#FDFAFF;border-radius:10px;border:1px solid #E8E0F8;">
      <div style="font-size:10px;color:#9B80C4;text-transform:uppercase;letter-spacing:.08em;font-weight:500;margin-bottom:8px">Notițe personalizate</div>
      <div style="font-size:13px;color:#4A3270;line-height:1.7;white-space:pre-wrap">${notes}</div>
    </div>` : ''}

    ${enrollLink ? `
    <div style="margin-top:16px;padding:24px;background:linear-gradient(135deg,#F5F0FF,#EDE5FF);border-radius:12px;border:1px solid #D4C0F0;text-align:center;">
      <div style="font-size:22px;margin-bottom:8px">🌸</div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#4A3270;font-weight:600;margin-bottom:8px">
        Începe călătoria ta alături de noi!
      </div>
      <div style="font-size:13px;color:#9B80C4;margin-bottom:18px;line-height:1.7;max-width:340px;margin-left:auto;margin-right:auto">
        Fii parte dintr-o echipă care te susține, te inspiră și crește împreună cu tine. Un singur pas te separă de această comunitate minunată.
      </div>
      <a href="${enrollLink}"
        style="display:inline-block;background:linear-gradient(135deg,#7B5EA7,#4A3270);border-radius:10px;padding:13px 36px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.03em;box-shadow:0 4px 15px rgba(123,94,167,0.3)">
        Înscrie-te în echipă →
      </a>
      <div style="font-size:11px;color:#C4A8E8;margin-top:12px">
        🌿 Young Living · Înregistrare oficială
      </div>
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
    if (!params.clientEmail || !params.clientEmail.includes('@') || params.clientEmail.includes('@noemail.local')) {
      setError('Clientul nu are un email valid. Adaugă un email în fișa de contact înainte să trimiți oferta.')
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

      // 1. Trimite emailul
      const { data, error: fnError } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.clientEmail,
          subject,
          html,
          contact_id: params.contactId || undefined,
        }
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      // 2. Salvează/actualizează contactul
      let contactId: string | null = params.contactId || null

      if (contactId) {
        // Vine din Contacts — actualizăm direct
        await supabase
          .from('contacts')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', contactId)
      } else {
        // Vine din Calculator direct — căutăm după email
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user!.id)
          .eq('email', params.clientEmail)
          .single()

        if (existingContact) {
          contactId = existingContact.id
          await supabase
            .from('contacts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', contactId)
        } else {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              user_id: user!.id,
              email: params.clientEmail,
              name: params.clientName || null,
              phone: params.clientPhone || null,
              status: 'prospect',
              first_offer_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          contactId = newContact?.id || null
        }
      }

      // 3. Salvează oferta
      await supabase
        .from('offers')
        .insert({
          user_id: user!.id,
          contact_id: contactId,
          products_json: params.items.map(i => ({
            name: i.name,
            sku: i.sku,
            qty: i.qty,
            disc: i.disc,
            price_eur: i.price_eur,
          })),
          transport: params.transport,
          notes: params.notes || null,
          total_display: params.totalDisplay,
          total_eur: params.totalEur,
          exchange_rate: params.exchangeRate,
          currency: params.currency || 'RON',
          sent_via: 'email',
        })

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