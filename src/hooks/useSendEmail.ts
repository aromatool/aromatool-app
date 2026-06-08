import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { createResourceLinks } from '../lib/resourceLink'
import { EMAIL_HEADER_HTML } from '../lib/emailLogo'
import { buildEmailFooter } from '../lib/emailFooter'
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
  resourceIds?: string[]   // resurse din bibliotecă, inserate ca linkuri
}

interface ResourceLink {
  title: string
  url: string
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


export function buildEmailHtml(params: SendOfferParams, userName: string, userPhone?: string, userEmail?: string, resourceLinks: ResourceLink[] = [], userSignature?: string): string {
  const { clientName, items, transport, totalDisplay, totalEur, exchangeRate, currency, notes, enrollLink } = params
  const displayCurrency = currency || 'RON'
  const rate = exchangeRate || 5.2523

  const rows = items.map(item => {
    const priceEur = item.price_eur
    const lineTotalEur = priceEur * item.qty * (1 - item.disc / 100)
    const lineTotalDisplay = lineTotalEur * rate
    const disc = item.disc > 0 ? `<span style="color:#C94F6A;font-size:11px"> −${item.disc}%</span>` : ''
    const secondaryEur = displayCurrency !== 'EUR' ? `<div style="font-size:11px;color:#A89888;margin-top:2px">€ ${lineTotalEur.toFixed(2)}</div>` : ''
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#3D3530">${item.name}${disc}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#A89888;text-align:center">${item.qty}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#3D3530;text-align:right;font-weight:600">
        ${fmtCurrency(lineTotalDisplay, displayCurrency)}${secondaryEur}
      </td>
    </tr>`
  }).join('')

  const transportDisplay = transport * rate

  const resourceButtons = resourceLinks.length > 0 ? `
    <div style="margin-top:16px;padding:16px;background:#FAFAF7;border-radius:10px;border:1px solid #E8F0E8;">
      <div style="font-size:10px;color:#5C7A5C;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:10px">Materiale atașate</div>
      ${resourceLinks.map(r => `
        <a href="${r.url}" style="display:block;margin-bottom:8px;padding:11px 16px;background:#5C7A5C;border-radius:8px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;text-align:center">
          📎 ${r.title}
        </a>`).join('')}
    </div>` : ''

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F2F5F0;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DDE6DD;">

  ${EMAIL_HEADER_HTML}

  <div style="padding:28px 28px 0;">
    <p style="font-size:15px;color:#3D3530;margin-bottom:6px;text-align:center">
      Bună ziua${clientName ? `, <strong>${clientName}</strong>` : ''}!
    </p>
    <p style="font-size:13px;color:#A89888;margin-bottom:24px;text-align:center">
      Oferta de mai jos a fost pregătită special pentru dumneavoastră<br>
      de către <strong style="color:#5C7A5C">${userName}</strong>.
    </p>

    <table style="width:100%;border-collapse:collapse;border:1px solid #E8F0E8;border-radius:10px;overflow:hidden;">
      <thead>
        <tr style="background:#F2F5F0;">
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:left;font-weight:600;text-transform:uppercase">Produs</th>
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:center;font-weight:600;text-transform:uppercase">Cant.</th>
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:right;font-weight:600;text-transform:uppercase">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${transport > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="padding:6px 16px;font-size:13px;color:#A89888">🚚 Transport</td>
        <td style="padding:6px 16px;font-size:13px;color:#6A5A50;text-align:right;font-weight:500">
          ${fmtCurrency(transportDisplay, displayCurrency)}
          ${displayCurrency !== 'EUR' ? `<span style="font-size:11px;color:#A89888;margin-left:6px">€ ${transport.toFixed(2)}</span>` : ''}
        </td>
      </tr>
    </table>` : ''}

    <table style="width:100%;border-collapse:collapse;background:#E8F0E8;border-radius:10px;margin-top:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:15px;color:#3D3530">Total de plată</td>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:26px;color:#3D3530;font-weight:600;text-align:right">
          ${fmtCurrency(totalDisplay, displayCurrency)}
          ${displayCurrency !== 'EUR' ? `<div style="font-size:13px;color:#A89888;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400">€ ${totalEur.toFixed(2)}</div>` : ''}
        </td>
      </tr>
    </table>

    ${notes ? `
    <div style="margin-top:14px;padding:14px 16px;background:#FAFAF7;border-radius:10px;border:1px solid #E8F0E8;">
      <div style="font-size:10px;color:#5C7A5C;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:8px">Notițe personalizate</div>
      <div style="font-size:13px;color:#3D3530;line-height:1.7;white-space:pre-wrap">${notes}</div>
    </div>` : ''}

    ${resourceButtons}

    ${enrollLink ? `
    <div style="margin-top:16px;padding:24px;background:linear-gradient(135deg,#E8F0E8,#E8F8F0);border-radius:12px;border:1px solid #CADBCA;text-align:center;">
      <div style="font-size:22px;margin-bottom:8px">🌸</div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#3D3530;font-weight:600;margin-bottom:8px">
        Începe călătoria ta alături de noi!
      </div>
      <div style="font-size:13px;color:#6A5A50;margin-bottom:18px;line-height:1.7;max-width:340px;margin-left:auto;margin-right:auto">
        Fii parte dintr-o echipă care te susține, te inspiră și crește împreună cu tine. Un singur pas te separă de această comunitate minunată.
      </div>
      <a href="${enrollLink}"
        style="display:inline-block;background:linear-gradient(135deg,#6B8E6B,#5C7A5C);border-radius:10px;padding:13px 36px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.03em;box-shadow:0 4px 15px rgba(92,122,92,0.3)">
        Înscrie-te în echipă →
      </a>
      <div style="font-size:11px;color:#A89888;margin-top:12px">
        🌿 Young Living · Înregistrare oficială
      </div>
    </div>` : ''}
  </div>

  ${buildEmailFooter({ userName, userPhone, userEmail, userSignature })}

  <div style="background:#FAFAF7;border-top:1px solid #EEF3EE;padding:12px 28px;text-align:center;">
    <span style="font-size:11px;color:#A89888">Trimis prin AromaTool</span>
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
      // ── Verificare communication controls dacă avem contact_id ──
      if (params.contactId) {
        const { data: contactCheck } = await supabase
          .from('contacts')
          .select('email_opt_out, communication_blocked')
          .eq('id', params.contactId)
          .single()

        if (contactCheck?.communication_blocked) {
          setError('Comunicarea este blocată pentru acest contact. Nu se poate trimite email.')
          setLoading(false)
          return false
        }
        if (contactCheck?.email_opt_out) {
          setError('Emailul este dezactivat pentru acest contact. Activează-l din fișa de contact înainte de trimitere.')
          setLoading(false)
          return false
        }
      }

      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'AromaTool'
      const userPhone = user?.user_metadata?.phone || ''
      const userEmail = user?.user_metadata?.contact_email || user?.email || ''
      const userSignature = user?.user_metadata?.email_signature || ''

      const subject = params.clientName
        ? `${params.clientName}, iată oferta ta — ${userName}`
        : `Oferta ta — ${userName}`

      // ── RESURSE: creăm linkuri securizate (token) înainte de trimitere ──
      const resourceIds = params.resourceIds ?? []
      const createdLinks = await createResourceLinks(user!.id, resourceIds, params.contactId)
      const linkRows = createdLinks.map(l => ({ id: l.id }))
      const resourceLinks: ResourceLink[] = createdLinks.map(l => ({ title: l.title, url: l.url }))

      const html = buildEmailHtml(params, userName, userPhone, userEmail, resourceLinks, userSignature)

      // 1. Trimite emailul
      const { data, error: fnError } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.clientEmail,
          subject,
          html,
          contact_id: params.contactId || undefined,
          from_name: userName,
          reply_to: userEmail || undefined,
        }
      })

      if (fnError || data?.error) {
        // Curățăm linkurile create dacă emailul a eșuat (fără orfani)
        if (linkRows.length > 0) {
          await supabase.from('resource_links').delete().in('id', linkRows.map(l => l.id))
        }
        if (fnError) throw fnError
        throw new Error(data.error)
      }

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
      const { data: newOffer } = await supabase
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
        .select('id')
        .single()

      // 4. Leagă linkurile de resurse de ofertă + contact (tracking)
      if (linkRows.length > 0) {
        await supabase
          .from('resource_links')
          .update({ offer_id: newOffer?.id ?? null, contact_id: contactId })
          .in('id', linkRows.map(l => l.id))
      }

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