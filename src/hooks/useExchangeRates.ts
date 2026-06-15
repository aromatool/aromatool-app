import { useQuery } from '@tanstack/react-query'
import { useCartStore } from './useCartStore'
import { supabase } from '../lib/supabase'

const CURRENCIES = ['RON', 'USD', 'GBP', 'CHF', 'HUF', 'PLN', 'CZK']

export interface RateMap {
  [currency: string]: number
}

// Fallback de siguranță (ultimele valori cunoscute, 2026-05-29). Folosit DOAR
// dacă tabelul `exchange_rates` din DB e gol sau inaccesibil — în mod normal
// cursurile vin live din DB, populate zilnic de Edge Function `refresh-rates`.
const FALLBACK_RATES: RateMap = {
  RON: 5.2523,
  USD: 1.1644,
  GBP: 0.86723,
  CHF: 0.9111,
  HUF: 353.69,
  PLN: 4.2275,
  CZK: 24.282,
}

export function useExchangeRates() {
  const { customRates, catalogCurrency } = useCartStore()
  // Moneda de bază a catalogului curent. Cursurile MANUALE sunt exprimate
  // „per 1 unitate din această monedă" (ex: pe catalog UK, customRates['RON']
  // = câți RON la 1 £). Cursurile LIVE rămân „per EUR".
  const base = catalogCurrency || 'EUR'

  const { data: liveRates, isLoading } = useQuery({
    queryKey: ['live-exchange-rates'],
    queryFn: async (): Promise<RateMap> => {
      // Cursurile live vin din tabelul DB populat de cron (`refresh-rates`).
      // Schema e pe perechi; citim rândurile cu from_currency='EUR'
      // (= reprezentarea „per EUR": rate = câte to_currency la 1 EUR).
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('to_currency, rate')
        .eq('from_currency', 'EUR')
      if (error || !data || data.length === 0) {
        if (error) console.error('exchange_rates fetch error:', error.message)
        return FALLBACK_RATES
      }
      const map: RateMap = {}
      for (const row of data) {
        const r = Number(row.rate)
        if (Number.isFinite(r) && r > 0) map[row.to_currency] = r
      }
      // Completăm cu fallback ca să nu rămână valute așteptate fără curs.
      return { ...FALLBACK_RATES, ...map }
    },
    staleTime: 1000 * 60 * 60,
    retry: false,
  })

  // Cursurile LIVE (per EUR). Cursurile MANUALE NU se mai amestecă aici, fiindcă
  // au altă ancoră (per moneda catalogului, nu per EUR) — se aplică separat în
  // `effectiveRate` de mai jos.
  const rates: RateMap = {
    EUR: 1,
    ...(liveRates || FALLBACK_RATES),
  }
  const safeCustom = customRates || {}

  function getRate(currency: string): number {
    const r = rates[currency]
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
    // Fail-loud: o valută fără curs NU trebuie tratată tăcut ca 1:1 (ar produce
    // prețuri grav greșite). Semnalăm eroarea și întoarcem NaN, ca rezultatul
    // să apară vizibil invalid ("NaN") în loc de un preț plauzibil dar fals.
    console.error(`getRate: curs lipsă pentru valuta "${currency}" — verifică exchange_rates.`)
    return NaN
  }

  // Cursul EFECTIV (nerotunjit) de la `from` la `to` (câte `to` la 1 `from`).
  // Regulă: dacă userul a setat un curs manual pentru moneda care NU e baza
  // catalogului, acela are prioritate și e interpretat „per 1 unitate de bază".
  //   from = bază, to are custom  → câte `to` la 1 bază       = custom[to]
  //   to   = bază, from are custom → inversul                 = 1 / custom[from]
  //   altfel                       → curs live prin EUR        = rate(to)/rate(from)
  function effectiveRate(from: string, to: string): number {
    if (from === to) return 1
    const cTo = safeCustom[to]
    const cFrom = safeCustom[from]
    if (from === base && typeof cTo === 'number' && cTo > 0) return cTo
    if (to === base && typeof cFrom === 'number' && cFrom > 0) return 1 / cFrom
    return getRate(to) / getRate(from)
  }

  // Conversie între moneda de bază a catalogului și moneda de afișare
  // (în ambele sensuri). Aplică `effectiveRate` și rotunjește la 2 zecimale.
  function convertFromBase(amount: number, from: string, target: string): number {
    if (from === target) return parseFloat(amount.toFixed(2))
    return parseFloat((amount * effectiveRate(from, target)).toFixed(2))
  }

  // Caz special, păstrat pentru compat: baza e EUR.
  function convertFromEur(eur: number, currency: string): number {
    return convertFromBase(eur, 'EUR', currency)
  }

  function formatAmount(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      RON: 'RON', EUR: '€', USD: '$', GBP: '£',
      CHF: 'CHF', HUF: 'Ft', PLN: 'zł', CZK: 'Kč'
    }
    const symbol = symbols[currency] || currency
    // Curs lipsă/invalid → effectiveRate poate da NaN, iar (NaN).toLocaleString
    // afișează literalmente „NaN" în totaluri, text WhatsApp și copy. Afișăm un
    // placeholder neutru în loc; trimiterea/salvarea ofertei e oricum oprită
    // separat de garda de curs din useSendEmail.
    if (!Number.isFinite(amount)) {
      return ['USD', 'GBP'].includes(currency) ? `${symbol}—` : `— ${symbol}`
    }
    const formatted = amount.toLocaleString('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (['USD', 'GBP'].includes(currency)) return `${symbol}${formatted}`
    return `${formatted} ${symbol}`
  }

  return { rates, liveRates, isLoading, base, getRate, effectiveRate, convertFromBase, convertFromEur, formatAmount, CURRENCIES }
}