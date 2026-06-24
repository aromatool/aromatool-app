import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../hooks/useProducts'

// Ce preț folosim în ofertă: angro (Brand Partner) sau retail (de listă).
export type PriceMode = 'wholesale' | 'retail'

// Prețul activ al unui produs/articol în funcție de mod. Retail doar dacă
// există (> 0); altfel cădem pe angro (produse importate înainte de retail).
export function priceFor(
  p: { price_eur: number; retail_price_eur?: number | null },
  mode: PriceMode,
): number {
  if (mode === 'retail' && p.retail_price_eur != null && p.retail_price_eur > 0) {
    return p.retail_price_eur
  }
  return p.price_eur
}

export interface CartItem extends Product {
  qty: number
  disc: number
  guideSelected: boolean
  isCustom?: boolean
  customPriceEur?: number  // custom items stored in catalog base currency
  // Descriere opțională inserată sub produs în email. Câmp runtime (nu se
  // persistă în coș) — setat în Calculator când userul bifează „include
  // descrierea". Nu confunda cu vreo coloană din `products`.
  description?: string
}

// Limite de siguranță pentru inputuri (C3). Orice valoare din UI sau din
// localStorage (care poate fi editat de user) trece prin aceste clamp-uri
// înainte să ajungă în calcule sau în oferta trimisă clientului.
const MAX_QTY = 9999

// qty: întreg ≥ 1, ≤ MAX_QTY. NaN/Infinity → 1.
export function sanitizeQty(qty: number): number {
  const n = Math.floor(Number(qty))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(MAX_QTY, n)
}

// disc: 0–100. NaN/Infinity → 0.
export function sanitizeDisc(disc: number): number {
  const n = Number(disc)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

// price: ≥ 0, finit. NaN/Infinity/negativ → 0.
export function sanitizePrice(price: number): number {
  const n = Number(price)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

// Validează un CartItem hidratat din localStorage. Returnează null dacă e
// corupt iremediabil (lipsă câmpuri esențiale), altfel îl normalizează.
function sanitizeCartItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return null
  const price = sanitizePrice(o.price_eur as number)
  return {
    ...(o as unknown as Product),
    id: o.id,
    name: o.name,
    price_eur: price,
    retail_price_eur: sanitizePrice((o.retail_price_eur as number) ?? 0),
    qty: sanitizeQty(o.qty as number),
    disc: sanitizeDisc(o.disc as number),
    guideSelected: Boolean(o.guideSelected),
    isCustom: o.isCustom === true ? true : undefined,
    customPriceEur: o.customPriceEur != null ? sanitizePrice(o.customPriceEur as number) : undefined,
  }
}

interface CartStore {
  items: CartItem[]
  transport: number       // transport in EUR
  clientName: string
  clientEmail: string
  clientPhone: string
  notes: string
  exchangeRate: number    // EUR/RON — kept for legacy sync
  currency: string        // display currency
  customRates: Record<string, number>
  catalogCountry: string  // country whose product catalog this offer uses
  catalogCurrency: string // base currency of the catalog (EUR, GBP, ...)
                          // — `price_eur` values are expressed in THIS currency
  offerLang: string       // email language for the client ('ro' | 'en'); '' = auto by catalog
  priceMode: PriceMode    // which price to use in the offer: 'wholesale' (default) | 'retail'

  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  updateDisc: (id: string, disc: number) => void
  toggleGuide: (id: string, selected: boolean) => void
  addCustomItem: (name: string, priceEur: number, qty: number, disc: number) => void
  setTransport: (value: number) => void
  setClientName: (name: string) => void
  setClientEmail: (email: string) => void
  setClientPhone: (phone: string) => void
  setNotes: (notes: string) => void
  setExchangeRate: (rate: number) => void
  setCurrency: (currency: string) => void
  setCatalogCountry: (country: string) => void
  setCatalogCurrency: (currency: string) => void
  setOfferLang: (lang: string) => void
  setPriceMode: (mode: PriceMode) => void
  setCustomRate: (currency: string, rate: number) => void
  prefillContactId: string | null
  setPrefillContactId: (id: string | null) => void
  clearCart: () => void

  // All computed values return EUR — convert to display currency in components
  getSubtotalEur: () => number
  getDiscountEur: () => number
  getTotalEur: () => number
  getTotalPoints: () => number
  getCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      transport: 0,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      notes: '',
      exchangeRate: 5.2523,
      currency: 'RON',
      customRates: {},
      catalogCountry: 'RO',
      catalogCurrency: 'EUR',
      offerLang: '',
      priceMode: 'wholesale',
      prefillContactId: null,

      addItem: (product) => set(state => {
        const existing = state.items.find(i => i.id === product.id)
        // Sincronizează moneda de bază a catalogului din produsul adăugat.
        // Pentru baze non-EUR (ex: GBP) setăm și moneda de AFIȘARE pe bază,
        // ca oferta UK să apară implicit în £ (pentru EUR păstrăm alegerea
        // userului — ex: RON pentru piața RO).
        const base = product.currency || state.catalogCurrency || 'EUR'
        const patch: Partial<CartStore> = { catalogCurrency: base }
        if (base !== 'EUR' && state.currency !== base) patch.currency = base
        if (existing) {
          return {
            ...patch,
            items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i),
          }
        }
        return {
          ...patch,
          items: [...state.items, { ...product, qty: 1, disc: 0, guideSelected: true }],
        }
      }),

      removeItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),

      updateQty: (id, qty) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, qty: sanitizeQty(qty) } : i)
      })),

      updateDisc: (id, disc) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, disc: sanitizeDisc(disc) } : i)
      })),

      toggleGuide: (id, selected) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, guideSelected: selected } : i)
      })),

      addCustomItem: (name, priceEur, qty, disc) => set(state => {
        const safePrice = sanitizePrice(priceEur)
        return {
          items: [...state.items, {
            id: 'custom_' + Date.now(),
            name,
            sku: 'CUSTOM',
            points: 0,
            price_eur: safePrice, // stored in catalog base currency
            retail_price_eur: safePrice, // produs custom: același preț în ambele moduri
            currency: state.catalogCurrency || 'EUR',
            qty: sanitizeQty(qty),
            disc: sanitizeDisc(disc),
            guideSelected: false,
            isCustom: true,
            customPriceEur: safePrice,
          }]
        }
      }),

      setTransport: (transport) => set({ transport }),
      setClientName: (clientName) => set({ clientName }),
      setClientEmail: (clientEmail) => set({ clientEmail }),
      setClientPhone: (clientPhone) => set({ clientPhone }),
      setNotes: (notes) => set({ notes }),
      setExchangeRate: (exchangeRate) => set({ exchangeRate }),
      setCurrency: (currency) => set({ currency }),
      // Schimbarea catalogului golește produsele din coș (prețurile/SKU diferă
      // de la o țară la alta — nu amestecăm cataloage în aceeași ofertă).
      setCatalogCountry: (catalogCountry) => set(state => (
        state.catalogCountry === catalogCountry
          ? { catalogCountry }
          // La schimbarea catalogului resetăm și moneda de bază — se va
          // re-deriva din primul produs adăugat din noul catalog. Golim și
          // cursurile manuale: ele sunt „per moneda catalogului", deci nu mai
          // au sens pe alt catalog (altă bază).
          : { catalogCountry, items: [], catalogCurrency: 'EUR', customRates: {} }
      )),
      setCatalogCurrency: (catalogCurrency) => set({ catalogCurrency }),
      setOfferLang: (offerLang) => set({ offerLang }),
      setPriceMode: (priceMode) => set({ priceMode }),
      setPrefillContactId: (prefillContactId) => set({ prefillContactId }),
      setCustomRate: (currency, rate) => set(state => ({
        customRates: { ...state.customRates, [currency]: rate }
      })),
      // Golirea coșului resetează ȘI legătura cu contactul (prefillContactId).
      // Altfel, după „Ofertă nouă" sau o trimitere, rămânea un contact_id
      // „lipit" de la oferta anterioară → emailul următor pleca la clientul
      // vechi (edge function-ul trimite la emailul contactului, nu la cel tastat).
      clearCart: () => set({ items: [], transport: 0, clientName: '', clientEmail: '', clientPhone: '', notes: '', offerLang: '', prefillContactId: null }),

      // All in EUR
      getSubtotalEur: () => {
        const { items, priceMode } = get()
        return items.reduce((sum, item) => {
          return sum + priceFor(item, priceMode) * item.qty
        }, 0)
      },

      getDiscountEur: () => {
        const { items, priceMode } = get()
        return items.reduce((sum, item) => {
          return sum + priceFor(item, priceMode) * item.qty * (item.disc / 100)
        }, 0)
      },

      getTotalEur: () => {
        const { transport } = get()
        const subtotal = get().getSubtotalEur()
        const discount = get().getDiscountEur()
        return subtotal - discount + transport
      },

      getTotalPoints: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + (item.points || 0) * item.qty, 0)
      },

      getCount: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.qty, 0)
      },
    }),
    {
      name: 'aromatool-cart',
      // Coșul persistat în localStorage poate fi editat manual de user (DevTools)
      // sau corupt între versiuni. Re-validăm fiecare item la hydrate (C3) ca să
      // nu intre prețuri/discounturi/qty invalide în calcule sau în oferta trimisă.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<CartStore>
        const rawItems = Array.isArray(p.items) ? p.items : []
        const items = rawItems
          .map(sanitizeCartItem)
          .filter((i): i is CartItem => i !== null)
        const transport = sanitizePrice((p as { transport?: number }).transport ?? 0)
        return { ...current, ...p, items, transport }
      },
      partialize: (state) => ({
        items: state.items,
        transport: state.transport,
        clientName: state.clientName,
        clientEmail: state.clientEmail,
        clientPhone: state.clientPhone,
        notes: state.notes,
        exchangeRate: state.exchangeRate,
        currency: state.currency,
        customRates: state.customRates,
        catalogCountry: state.catalogCountry,
        catalogCurrency: state.catalogCurrency,
        offerLang: state.offerLang,
        priceMode: state.priceMode,
        prefillContactId: state.prefillContactId,
      }),
    }
  )
)