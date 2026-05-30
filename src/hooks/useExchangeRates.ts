import { useQuery } from '@tanstack/react-query'
import { useCartStore } from './useCartStore'

const CURRENCIES = ['RON', 'USD', 'GBP', 'CHF', 'HUF', 'PLN', 'CZK']

export interface RateMap {
  [currency: string]: number
}

// ⚠️  TODO BEFORE GO-LIVE: Replace hardcoded rates with live API call.
// API: https://api.frankfurter.app/latest?from=EUR&to=RON,USD,GBP,CHF,HUF,PLN,CZK
// Blocked by CORS in browser — needs a backend proxy (Supabase Edge Function).
// Last real API response (2026-05-29):
// {"amount":1,"base":"EUR","date":"2026-05-29","rates":{"CHF":0.9111,"CZK":24.282,"GBP":0.86723,"HUF":353.69,"PLN":4.2275,"RON":5.2523,"USD":1.1644}}
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
    queryFn: async () => {
      // TODO: Replace with Supabase Edge Function proxy to avoid CORS
      // For now returns fallback rates immediately
      return FALLBACK_RATES
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
    return rates[currency] || 1
  }

  function convertFromEur(eur: number, currency: string): number {
    return parseFloat((eur * getRate(currency)).toFixed(2))
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

  return { rates, liveRates, isLoading, getRate, convertFromEur, formatAmount, CURRENCIES }
}