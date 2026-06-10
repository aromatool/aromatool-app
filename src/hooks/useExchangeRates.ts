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
  const { customRates } = useCartStore()

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

  // Merge fallback/live rates with custom overrides
  const rates: RateMap = {
    EUR: 1,
    ...(liveRates || FALLBACK_RATES),
    ...Object.fromEntries(
      Object.entries(customRates || {}).filter(([, v]) => v && v > 0)
    ),
  }

  function getRate(currency: string): number {
    const r = rates[currency]
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
    // Fail-loud: o valută fără curs NU trebuie tratată tăcut ca 1:1 (ar produce
    // prețuri grav greșite). Semnalăm eroarea și întoarcem NaN, ca rezultatul
    // să apară vizibil invalid ("NaN") în loc de un preț plauzibil dar fals.
    console.error(`getRate: curs lipsă pentru valuta "${currency}" — verifică exchange_rates.`)
    return NaN
  }

  // Conversie generală între două monede. Cursurile sunt exprimate „per EUR”
  // (rates[X] = câte X la 1 EUR), deci trecem prin EUR ca pivot:
  //   amount[base] → EUR: amount / getRate(base)
  //   EUR → target:       × getRate(target)
  function convertFromBase(amount: number, base: string, target: string): number {
    if (base === target) return parseFloat(amount.toFixed(2))
    const inEur = amount / getRate(base)
    return parseFloat((inEur * getRate(target)).toFixed(2))
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
    const formatted = amount.toLocaleString('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (['USD', 'GBP'].includes(currency)) return `${symbol}${formatted}`
    return `${formatted} ${symbol}`
  }

  return { rates, liveRates, isLoading, getRate, convertFromBase, convertFromEur, formatAmount, CURRENCIES }
}