import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../hooks/useProducts'

export interface CartItem extends Product {
  qty: number
  disc: number
  guideSelected: boolean
  isCustom?: boolean
  customPriceEur?: number  // custom items stored in EUR
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
  setCustomRate: (currency: string, rate: number) => void
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
      prefillContactId: null,

      addItem: (product) => set(state => {
        const existing = state.items.find(i => i.id === product.id)
        if (existing) {
          return { items: state.items.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) }
        }
        return { items: [...state.items, { ...product, qty: 1, disc: 0, guideSelected: true }] }
      }),

      removeItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),

      updateQty: (id, qty) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i)
      })),

      updateDisc: (id, disc) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, disc: Math.min(100, Math.max(0, disc)) } : i)
      })),

      toggleGuide: (id, selected) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, guideSelected: selected } : i)
      })),

      addCustomItem: (name, priceEur, qty, disc) => set(state => ({
        items: [...state.items, {
          id: 'custom_' + Date.now(),
          name,
          sku: 'CUSTOM',
          points: 0,
          price_eur: priceEur, // stored as EUR
          qty,
          disc,
          guideSelected: false,
          isCustom: true,
          customPriceEur: priceEur,
        }]
      })),

      setTransport: (transport) => set({ transport }),
      setClientName: (clientName) => set({ clientName }),
      setClientEmail: (clientEmail) => set({ clientEmail }),
      setClientPhone: (clientPhone) => set({ clientPhone }),
      setNotes: (notes) => set({ notes }),
      setExchangeRate: (exchangeRate) => set({ exchangeRate }),
      setCurrency: (currency) => set({ currency }),
      setPrefillContactId: (prefillContactId) => set({ prefillContactId }),
      setCustomRate: (currency, rate) => set(state => ({
        customRates: { ...state.customRates, [currency]: rate }
      })),
      clearCart: () => set({ items: [], transport: 0, clientName: '', clientEmail: '', clientPhone: '', notes: '' }),

      // All in EUR
      getSubtotalEur: () => {
        const { items } = get()
        return items.reduce((sum, item) => {
          return sum + item.price_eur * item.qty
        }, 0)
      },

      getDiscountEur: () => {
        const { items } = get()
        return items.reduce((sum, item) => {
          return sum + item.price_eur * item.qty * (item.disc / 100)
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
        prefillContactId: state.prefillContactId,
      }),
    }
  )
)