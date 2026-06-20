import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSubscription } from '../lib/subscription'
import { createResourceLinks } from '../lib/resourceLink'
import { EMAIL_HEADER_HTML } from '../lib/emailLogo'
import { buildEmailFooter } from '../lib/emailFooter'
import { escapeHtml } from '../lib/escapeHtml'
import i18n from '../i18n'
import type { CartItem } from './useCartStore'

interface SendOfferParams {
  clientName: string
  clientEmail: string
  clientPhone?: string
  contactId?: string
  notes: string
  items: CartItem[]
  transport: number       // în moneda de bază a ofertei
  totalDisplay: number        // total in display currency
  totalEur: number        // total în moneda de bază (nume istoric)
  exchangeRate: number    // factor bază → monedă de afișare
  currency: string        // display currency code
  baseCurrency?: string   // moneda de bază a catalogului (EUR, GBP, ...)
  lang?: string           // limba emailului către client ('ro' | 'en')
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

// Transformă URL-urile dintr-un text DEJA escapat în linkuri clicabile.
// Se aplică STRICT după escapeHtml (textul nu mai conține `<` / `>` brute),
// ca să nu permitem injectare de markup. Punctuația finală e lăsată în afara
// linkului ca să nu „lipim" un punct/virgulă de URL.
function linkifyEscaped(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const trailing = url.match(/[.,!?;:)]+$/)
    const clean = trailing ? url.slice(0, -trailing[0].length) : url
    const tail = trailing ? trailing[0] : ''
    return `<a href="${clean}" style="color:#5C7A5C;text-decoration:underline">${clean}</a>${tail}`
  })
}

// Rotunjire la bani (2 zecimale). Folosită ca să facem TOTALUL = suma liniilor
// AFIȘATE, nu rotunjirea sumei brute (altfel totalul putea diferi de adunarea
// manuală a clientului cu 1-2 bani — „penny rounding").
export const round2 = (n: number) => Math.round(n * 100) / 100

// Sursa unică pentru totaluri consistente: total = Σ(linii rotunjite) + transport
// rotunjit. Folosit ATÂT la randarea emailului CÂT ȘI la salvarea ofertei, ca
// suma stocată să fie identică cu cea pe care o vede clientul.
export function computeOfferTotals(
  items: CartItem[],
  transport: number,
  rate: number
): { totalEur: number; totalDisplay: number } {
  let sumDisplay = 0
  let sumEur = 0
  for (const item of items) {
    const lineEur = round2(item.price_eur * item.qty * (1 - item.disc / 100))
    sumEur += lineEur
    sumDisplay += round2(lineEur * rate)
  }
  return {
    totalEur: round2(sumEur + round2(transport)),
    totalDisplay: round2(sumDisplay + round2(transport * rate)),
  }
}


export function buildEmailHtml(params: SendOfferParams, userName: string, userPhone?: string, userEmail?: string, resourceLinks: ResourceLink[] = [], userSignature?: string): string {
  const { clientName, items, transport, exchangeRate, currency, baseCurrency, lang, notes, enrollLink } = params
  const displayCurrency = currency || 'RON'
  const base = baseCurrency || 'EUR'
  // `rate` = factor bază → afișare. (Default 1 → ofertă în aceeași monedă.)
  const rate = exchangeRate || 1
  // Limba emailului către client (implicit RO). Helper local cu lng fix.
  const lng = lang || 'ro'
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng, ...opts })

  const rows = items.map(item => {
    const hasDisc = item.disc > 0
    const lineEur = round2(item.price_eur * item.qty * (1 - item.disc / 100))
    const lineDisplay = round2(lineEur * rate)
    // Prețul întreg (fără reducere), rotunjit la fel ca linia redusă.
    const origDisplay = round2(round2(item.price_eur * item.qty) * rate)
    const disc = hasDisc ? `<span style="color:#C94F6A;font-size:11px"> −${item.disc}%</span>` : ''
    const secondaryEur = displayCurrency !== base ? `<div style="font-size:11px;color:#A89888;margin-top:2px">${fmtCurrency(lineEur, base)}</div>` : ''
    // Când există reducere: prețul întreg TĂIAT (mic, gri) + prețul redus
    // (bold). Clientul vede clar „costa X, plătești Y".
    const priceCell = hasDisc
      ? `<span style="font-size:12px;color:#A89888;font-weight:400;text-decoration:line-through">${fmtCurrency(origDisplay, displayCurrency)}</span>
        <div style="font-weight:700;color:#3D3530">${fmtCurrency(lineDisplay, displayCurrency)}</div>${secondaryEur}`
      : `${fmtCurrency(lineDisplay, displayCurrency)}${secondaryEur}`
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#3D3530">${escapeHtml(item.name)}${disc}${item.description ? `<div style="font-size:12px;color:#8A7A6C;margin-top:4px;line-height:1.55;font-weight:400;white-space:pre-wrap">${escapeHtml(item.description)}</div>` : ''}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#A89888;text-align:center">${item.qty}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #EEF3EE;font-size:14px;color:#3D3530;text-align:right;font-weight:600">
        ${priceCell}
      </td>
    </tr>`
  }).join('')

  const transportDisplay = round2(transport * rate)
  // Total = Σ linii rotunjite + transport rotunjit (consistent cu afișarea).
  const { totalEur, totalDisplay } = computeOfferTotals(items, transport, rate)

  // Mesajul personal e piesa principală a ofertei → bloc proeminent, ÎNAINTEA
  // tabelului de produse. URL-urile devin clicabile (linkify după escape).
  const notesBlock = notes ? `
    <div style="margin:0 0 24px;padding:18px 20px;background:linear-gradient(135deg,#F4F8F2,#EAF3E8);border-radius:12px;border:1px solid #D7E5D3;">
      <div style="font-size:10px;color:#5C7A5C;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:8px">${t('email.notesLabel')}</div>
      <div style="font-size:14px;color:#3D3530;line-height:1.75;white-space:pre-wrap">${linkifyEscaped(escapeHtml(notes))}</div>
    </div>` : ''

  const resourceButtons = resourceLinks.length > 0 ? `
    <div style="margin-top:16px;padding:16px;background:#FAFAF7;border-radius:10px;border:1px solid #E8F0E8;">
      <div style="font-size:10px;color:#5C7A5C;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:10px">${t('email.materialsLabel')}</div>
      ${resourceLinks.map(r => `
        <a href="${encodeURI(r.url)}" style="display:block;margin-bottom:8px;padding:11px 16px;background:#5C7A5C;border-radius:8px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;text-align:center">
          📎 ${escapeHtml(r.title)}
        </a>`).join('')}
    </div>` : ''

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F2F5F0;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DDE6DD;">

  ${EMAIL_HEADER_HTML}

  <div style="padding:28px 28px 24px;">
    <p style="font-size:15px;color:#3D3530;margin-bottom:6px;text-align:center">
      ${t('email.greeting')}${clientName ? `, <strong>${escapeHtml(clientName)}</strong>` : ''}!
    </p>
    <p style="font-size:13px;color:#A89888;margin-bottom:24px;text-align:center">
      ${t('email.intro', { user: userName })}
    </p>

    ${notesBlock}

    <table style="width:100%;border-collapse:collapse;border:1px solid #E8F0E8;border-radius:10px;overflow:hidden;">
      <thead>
        <tr style="background:#F2F5F0;">
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:left;font-weight:600;text-transform:uppercase">${t('email.colProduct')}</th>
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:center;font-weight:600;text-transform:uppercase">${t('email.colQty')}</th>
          <th style="padding:10px 16px;font-size:11px;color:#A89888;text-align:right;font-weight:600;text-transform:uppercase">${t('email.colTotal')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="text-align:center;font-size:12px;color:#A89888;margin-top:10px">
      ${t('email.productCount', { count: items.length })}
    </div>

    ${transport > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="padding:6px 16px;font-size:13px;color:#A89888">${t('email.transport')}</td>
        <td style="padding:6px 16px;font-size:13px;color:#6A5A50;text-align:right;font-weight:500">
          ${fmtCurrency(transportDisplay, displayCurrency)}
          ${displayCurrency !== base ? `<span style="font-size:11px;color:#A89888;margin-left:6px">${fmtCurrency(transport, base)}</span>` : ''}
        </td>
      </tr>
    </table>` : ''}

    <table style="width:100%;border-collapse:collapse;background:#E8F0E8;border-radius:10px;margin-top:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:15px;color:#3D3530">${t('email.totalToPay')}</td>
        <td style="padding:16px 20px;font-family:Georgia,serif;font-size:26px;color:#3D3530;font-weight:600;text-align:right">
          ${fmtCurrency(totalDisplay, displayCurrency)}
          ${displayCurrency !== base ? `<div style="font-size:13px;color:#A89888;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400">${fmtCurrency(totalEur, base)}</div>` : ''}
        </td>
      </tr>
    </table>

    ${resourceButtons}

    ${enrollLink ? `
    <div style="margin-top:16px;padding:24px;background:linear-gradient(135deg,#E8F0E8,#E8F8F0);border-radius:12px;border:1px solid #CADBCA;text-align:center;">
      <div style="font-size:22px;margin-bottom:8px">🌸</div>
      <div style="font-family:Georgia,serif;font-size:18px;color:#3D3530;font-weight:600;margin-bottom:8px">
        ${t('email.enrollTitle')}
      </div>
      <div style="font-size:13px;color:#6A5A50;margin-bottom:18px;line-height:1.7;max-width:340px;margin-left:auto;margin-right:auto">
        ${t('email.enrollBody')}
      </div>
      <a href="${enrollLink}"
        style="display:inline-block;background:linear-gradient(135deg,#6B8E6B,#5C7A5C);border-radius:10px;padding:13px 36px;color:white;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.03em;box-shadow:0 4px 15px rgba(92,122,92,0.3)">
        ${t('email.enrollButton')}
      </a>
      <div style="font-size:11px;color:#A89888;margin-top:12px">
        ${t('email.enrollFooter')}
      </div>
    </div>` : ''}
  </div>

  ${buildEmailFooter({ userName, userPhone, userEmail, userSignature, lang: lng })}

  <div style="background:#FAFAF7;border-top:1px solid #EEF3EE;padding:12px 28px;text-align:center;">
    <span style="font-size:11px;color:#A89888">${t('email.sentVia')}</span>
  </div>

</div>
</body></html>`
}

// Versiune text/plain a emailului de ofertă. Trimisă alături de HTML ca
// multipart/alternative → mai bună livrabilitate (un email HTML-only e un
// semnal slab pentru filtrele de spam) + fallback pentru clienții care nu
// randează HTML. Oglindește conținutul din `buildEmailHtml`, fără markup.
export function buildEmailText(params: SendOfferParams, userName: string, userPhone?: string, userEmail?: string, resourceLinks: ResourceLink[] = [], userSignature?: string): string {
  const { clientName, items, transport, exchangeRate, currency, baseCurrency, lang, notes, enrollLink } = params
  const displayCurrency = currency || 'RON'
  const base = baseCurrency || 'EUR'
  const rate = exchangeRate || 1
  const lng = lang || 'ro'
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { lng, ...opts })

  const lines: string[] = []

  lines.push(`${t('email.greeting')}${clientName ? `, ${clientName}` : ''}!`)
  lines.push('')
  lines.push(t('email.intro', { user: userName }))
  lines.push('')

  // Mesajul personal apare ÎNAINTEA produselor (oglindă cu varianta HTML).
  if (notes) {
    lines.push(`${t('email.notesLabel')}:`)
    lines.push(notes)
    lines.push('')
  }

  // Produse: o linie per produs. La reducere afișăm prețul întreg → prețul
  // redus (text/plain nu are tăiere fiabilă, deci folosim săgeata).
  for (const item of items) {
    const lineEur = round2(item.price_eur * item.qty * (1 - item.disc / 100))
    const lineDisplay = round2(lineEur * rate)
    const secondary = displayCurrency !== base ? ` (${fmtCurrency(lineEur, base)})` : ''
    if (item.disc > 0) {
      const origDisplay = round2(round2(item.price_eur * item.qty) * rate)
      lines.push(`- ${item.name} × ${item.qty} — ${fmtCurrency(origDisplay, displayCurrency)} → ${fmtCurrency(lineDisplay, displayCurrency)} (−${item.disc}%)${secondary}`)
    } else {
      lines.push(`- ${item.name} × ${item.qty} — ${fmtCurrency(lineDisplay, displayCurrency)}${secondary}`)
    }
    if (item.description) lines.push(`    ${item.description.replace(/\n/g, '\n    ')}`)
  }
  lines.push(t('email.productCount', { count: items.length }))
  lines.push('')

  if (transport > 0) {
    const transportDisplay = round2(transport * rate)
    const transportSecondary = displayCurrency !== base ? ` (${fmtCurrency(transport, base)})` : ''
    lines.push(`${t('email.transport')}: ${fmtCurrency(transportDisplay, displayCurrency)}${transportSecondary}`)
  }

  const { totalEur, totalDisplay } = computeOfferTotals(items, transport, rate)
  const totalSecondary = displayCurrency !== base ? ` (${fmtCurrency(totalEur, base)})` : ''
  lines.push(`${t('email.totalToPay')}: ${fmtCurrency(totalDisplay, displayCurrency)}${totalSecondary}`)
  lines.push('')

  if (resourceLinks.length > 0) {
    lines.push(`${t('email.materialsLabel')}:`)
    for (const r of resourceLinks) lines.push(`- ${r.title}: ${r.url}`)
    lines.push('')
  }

  if (enrollLink) {
    lines.push(t('email.enrollTitle'))
    lines.push(t('email.enrollBody'))
    lines.push(`${t('email.enrollButton')} ${enrollLink}`)
    lines.push('')
  }

  // Încheiere caldă + invitație la răspuns.
  lines.push(t('email.closingQuestions'))
  lines.push('')
  lines.push(t('email.closingWarm'))
  lines.push('')

  // Semnătură / contact distribuitor.
  lines.push('—')
  lines.push(userSignature || userName)
  if (userPhone) lines.push(userPhone)
  if (userEmail) lines.push(userEmail)
  lines.push('')
  lines.push(t('email.sentVia'))

  return lines.join('\n')
}

export function useSendEmail() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { user } = useAuth()
  const { requireAccess } = useSubscription()

  const sendOffer = async (params: SendOfferParams) => {
    if (!requireAccess()) return false
    if (!params.clientEmail || !params.clientEmail.includes('@') || params.clientEmail.includes('@noemail.local')) {
      setError(i18n.t('offers.sendErrInvalidEmail'))
      return false
    }
    if (params.items.length === 0) {
      setError(i18n.t('offers.sendErrEmptyCart'))
      return false
    }
    // H1: NU trimite/salva o ofertă cu un curs valutar invalid (NaN/0). getRate()
    // întoarce NaN când lipsește un curs → altfel am persista total_display=NaN
    // în `offers` și am trimite „NaN" clientului. Oprim devreme, cu mesaj clar.
    if (!Number.isFinite(params.exchangeRate) || params.exchangeRate <= 0) {
      setError(i18n.t('offers.sendErrRate'))
      return false
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    // Totaluri consistente (Σ linii rotunjite), folosite la salvarea ofertei.
    const offerTotals = computeOfferTotals(params.items, params.transport, params.exchangeRate)
    // Plasă de siguranță: dacă totalurile ies non-finite (preț corupt), oprim.
    if (!Number.isFinite(offerTotals.totalEur) || !Number.isFinite(offerTotals.totalDisplay)) {
      setError(i18n.t('offers.sendErrRate'))
      return false
    }

    try {
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'AromaTool'
      const userPhone = user?.user_metadata?.phone || ''
      const userEmail = user?.user_metadata?.contact_email || user?.email || ''
      const userSignature = user?.user_metadata?.email_signature || ''

      // ── Rezolvă/creează contactul ÎNAINTE de trimitere ───────────────────
      // Avem nevoie de un contact_id încă de la send: doar așa edge function-ul
      // injectează linkul de dezabonare + header-ele List-Unsubscribe (cerute
      // de Gmail/Yahoo). Altfel PRIMA ofertă către o adresă nouă (cazul tipic)
      // pleca fără unsubscribe. Bonus: dacă adresa tastată corespunde unui
      // contact deja dezabonat/blocat, verificarea de mai jos îl prinde.
      let contactId: string | null = params.contactId || null
      let createdNewContactId: string | null = null
      if (!contactId) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user!.id)
          .eq('email', params.clientEmail)
          .maybeSingle()
        if (existingContact) {
          contactId = existingContact.id
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
          createdNewContactId = contactId
        }
      }

      // ── Communication controls (acum acoperă și contactele rezolvate după email) ──
      if (contactId) {
        const { data: contactCheck } = await supabase
          .from('contacts')
          .select('email_opt_out, communication_blocked')
          .eq('id', contactId)
          .single()

        if (contactCheck?.communication_blocked) {
          // Nu lăsa în urmă un contact orfan creat acum dacă oprim trimiterea.
          if (createdNewContactId) await supabase.from('contacts').delete().eq('id', createdNewContactId)
          setError(i18n.t('offers.sendErrBlocked'))
          setLoading(false)
          return false
        }
        if (contactCheck?.email_opt_out) {
          if (createdNewContactId) await supabase.from('contacts').delete().eq('id', createdNewContactId)
          setError(i18n.t('offers.sendErrOptOut'))
          setLoading(false)
          return false
        }
      }

      const lng = params.lang || 'ro'
      const subject = params.clientName
        ? i18n.t('email.subjectWithName', { lng, name: params.clientName, user: userName })
        : i18n.t('email.subject', { lng, user: userName })

      // ── RESURSE: creăm linkuri securizate (token) înainte de trimitere ──
      const resourceIds = params.resourceIds ?? []
      const createdLinks = await createResourceLinks(user!.id, resourceIds, contactId || undefined)
      const linkRows = createdLinks.map(l => ({ id: l.id }))
      const resourceLinks: ResourceLink[] = createdLinks.map(l => ({ title: l.title, url: l.url }))

      const html = buildEmailHtml(params, userName, userPhone, userEmail, resourceLinks, userSignature)
      const text = buildEmailText(params, userName, userPhone, userEmail, resourceLinks, userSignature)

      // 1. Trimite emailul (cu contact_id → unsubscribe garantat)
      const { data, error: fnError } = await supabase.functions.invoke('send-email', {
        body: {
          to: params.clientEmail,
          subject,
          html,
          text,
          contact_id: contactId || undefined,
          from_name: userName,
          reply_to: userEmail || undefined,
        }
      })

      if (fnError || data?.error) {
        // Curățăm linkurile + contactul nou create dacă emailul a eșuat (fără orfani)
        if (linkRows.length > 0) {
          await supabase.from('resource_links').delete().in('id', linkRows.map(l => l.id))
        }
        if (createdNewContactId) {
          await supabase.from('contacts').delete().eq('id', createdNewContactId)
        }
        // Pentru statusuri non-2xx (ex. 402 abonament, 429 rate-limit) mesajul
        // util e în corpul răspunsului, nu în fnError (care e generic). Îl extragem.
        if (fnError) {
          let msg = fnError.message
          const ctx = (fnError as { context?: Response }).context
          if (ctx && typeof ctx.json === 'function') {
            try {
              const body = await ctx.json()
              if (body?.error) msg = body.error
            } catch { /* corp ne-JSON — păstrăm mesajul generic */ }
          }
          throw new Error(msg)
        }
        throw new Error(data.error)
      }

      // 2. Marcați activitate pe contact (creat sau existent)
      if (contactId) {
        await supabase
          .from('contacts')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', contactId)
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
          // Totaluri consistente cu emailul (Σ linii rotunjite), nu valoarea
          // brută din calculator → evită discrepanțe de 1-2 bani în istoricul ofertelor.
          total_display: offerTotals.totalDisplay,
          total_eur: offerTotals.totalEur,
          exchange_rate: params.exchangeRate,
          currency: params.currency || 'RON',
          base_currency: params.baseCurrency || 'EUR',
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
      setError(err.message || i18n.t('offers.sendErrGeneric'))
      return false
    } finally {
      setLoading(false)
    }
  }

  // ── Loghează o ofertă FĂRĂ să trimită email ──────────────────────────
  // Pentru cazurile în care oferta a fost comunicată pe alt canal (WhatsApp,
  // telefon, în persoană etc.): salvăm aceeași ofertă în `offers`, cu
  // `sent_via` setat pe canalul ales, ca să apară în istoric și să scoată
  // contactul din „Trimite prima ofertă". Refolosește exact aceeași logică de
  // rezolvare a contactului ca `sendOffer`, dar sare peste pasul de email.
  const logOffer = async (
    params: SendOfferParams,
    sentVia: 'whatsapp' | 'phone' | 'other'
  ) => {
    if (!requireAccess()) return false
    if (params.items.length === 0) {
      setError(i18n.t('offers.sendErrEmptyCart'))
      return false
    }
    if (!Number.isFinite(params.exchangeRate) || params.exchangeRate <= 0) {
      setError(i18n.t('offers.sendErrRate'))
      return false
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    const offerTotals = computeOfferTotals(params.items, params.transport, params.exchangeRate)
    if (!Number.isFinite(offerTotals.totalEur) || !Number.isFinite(offerTotals.totalDisplay)) {
      setError(i18n.t('offers.sendErrRate'))
      setLoading(false)
      return false
    }

    try {
      // Respectăm blocarea comunicării și pentru un log manual.
      if (params.contactId) {
        const { data: contactCheck } = await supabase
          .from('contacts')
          .select('communication_blocked')
          .eq('id', params.contactId)
          .single()
        if (contactCheck?.communication_blocked) {
          setError(i18n.t('offers.sendErrBlocked'))
          setLoading(false)
          return false
        }
      }

      // 1. Rezolvă/creează contactul (identic cu fluxul de email)
      let contactId: string | null = params.contactId || null
      if (contactId) {
        await supabase
          .from('contacts')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', contactId)
      } else if (params.clientEmail && !params.clientEmail.includes('@noemail.local')) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user!.id)
          .eq('email', params.clientEmail)
          .maybeSingle()
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

      // 2. Resurse atașate (dacă există) → linkuri securizate
      const resourceIds = params.resourceIds ?? []
      const createdLinks = resourceIds.length > 0
        ? await createResourceLinks(user!.id, resourceIds, contactId || undefined)
        : []
      const linkRows = createdLinks.map(l => ({ id: l.id }))

      // 3. Salvează oferta cu canalul ales (fără email)
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
          total_display: offerTotals.totalDisplay,
          total_eur: offerTotals.totalEur,
          exchange_rate: params.exchangeRate,
          currency: params.currency || 'RON',
          base_currency: params.baseCurrency || 'EUR',
          sent_via: sentVia,
        })
        .select('id')
        .single()

      if (linkRows.length > 0) {
        await supabase
          .from('resource_links')
          .update({ offer_id: newOffer?.id ?? null, contact_id: contactId })
          .in('id', linkRows.map(l => l.id))
      }

      setSuccess(true)
      return true
    } catch (err: any) {
      console.error('Log offer error:', err)
      setError(err.message || i18n.t('offers.sendErrGeneric'))
      return false
    } finally {
      setLoading(false)
    }
  }

  // ── Marchează o ofertă ca trimisă din CRM, FĂRĂ produse și FĂRĂ email ──
  // Pentru cazul în care distribuitorul a comunicat deja oferta (telefon,
  // WhatsApp, în persoană) și vrea doar să noteze faptul în CRM, fără să o
  // reconstruiască în Calculator. Salvăm un rând MINIMAL în `offers` (fără
  // produse, total 0) cu `sent_via` = canalul ales, exact cât să apară în
  // istoric și să scoată contactul din „Trimite prima ofertă". Pentru oferta
  // reală cu produse se folosește `logOffer` (din Calculator).
  const markOfferSent = async (
    contactId: string,
    sentVia: 'whatsapp' | 'phone' | 'other'
  ) => {
    if (!requireAccess()) return false
    if (!contactId) return false

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Respectăm blocarea comunicării și pentru un log manual.
      const { data: contactCheck } = await supabase
        .from('contacts')
        .select('communication_blocked')
        .eq('id', contactId)
        .single()
      if (contactCheck?.communication_blocked) {
        setError(i18n.t('offers.sendErrBlocked'))
        setLoading(false)
        return false
      }

      await supabase
        .from('contacts')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', contactId)

      const { error: insErr } = await supabase
        .from('offers')
        .insert({
          user_id: user!.id,
          contact_id: contactId,
          products_json: [],
          transport: 0,
          notes: null,
          total_display: 0,
          total_eur: 0,
          exchange_rate: 1,
          currency: 'RON',
          base_currency: 'EUR',
          sent_via: sentVia,
        })
      if (insErr) throw new Error(insErr.message)

      setSuccess(true)
      return true
    } catch (err: any) {
      console.error('Mark offer sent error:', err)
      setError(err.message || i18n.t('offers.sendErrGeneric'))
      return false
    } finally {
      setLoading(false)
    }
  }

  return { sendOffer, logOffer, markOfferSent, loading, error, success, setError, setSuccess }
}