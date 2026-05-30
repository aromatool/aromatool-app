import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "./useProducts";
export interface CartItem extends Product {
  qty: number;
  disc: number;
  guideSelected: boolean;
  isCustom?: boolean;
  customPriceRon?: number;
}

interface CartStore {
  items: CartItem[];
  transport: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
  exchangeRate: number;

  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  updateDisc: (id: string, disc: number) => void;
  toggleGuide: (id: string, selected: boolean) => void;
  addCustomItem: (
    name: string,
    priceRon: number,
    qty: number,
    disc: number,
  ) => void;
  setTransport: (value: number) => void;
  setClientName: (name: string) => void;
  setClientEmail: (email: string) => void;
  setClientPhone: (phone: string) => void;
  setNotes: (notes: string) => void;
  setExchangeRate: (rate: number) => void;
  clearCart: () => void;

  // Computed
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  getTotalEur: () => number;
  getTotalPoints: () => number;
  getCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      transport: 0,
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      notes: "",
      exchangeRate: 5.2444,

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id ? { ...i, qty: i.qty + 1 } : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...product, qty: 1, disc: 0, guideSelected: true },
            ],
          };
        }),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, qty: Math.max(1, qty) } : i,
          ),
        })),

      updateDisc: (id, disc) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, disc: Math.min(100, Math.max(0, disc)) } : i,
          ),
        })),

      toggleGuide: (id, selected) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, guideSelected: selected } : i,
          ),
        })),

      addCustomItem: (name, priceRon, qty, disc) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              id: "custom_" + Date.now(),
              name,
              sku: "CUSTOM",
              points: 0,
              price_eur: 0,
              qty,
              disc,
              guideSelected: false,
              isCustom: true,
              customPriceRon: priceRon,
            },
          ],
        })),

      setTransport: (transport) => set({ transport }),
      setClientName: (clientName) => set({ clientName }),
      setClientEmail: (clientEmail) => set({ clientEmail }),
      setClientPhone: (clientPhone) => set({ clientPhone }),
      setNotes: (notes) => set({ notes }),
      setExchangeRate: (exchangeRate) => set({ exchangeRate }),
      clearCart: () =>
        set({
          items: [],
          transport: 0,
          clientName: "",
          clientEmail: "",
          clientPhone: "",
          notes: "",
        }),

      getSubtotal: () => {
        const { items, exchangeRate } = get();
        return items.reduce((sum, item) => {
          const priceRon = item.isCustom
            ? item.customPriceRon || 0
            : item.price_eur * exchangeRate;
          return sum + priceRon * item.qty;
        }, 0);
      },

      getDiscount: () => {
        const { items, exchangeRate } = get();
        return items.reduce((sum, item) => {
          const priceRon = item.isCustom
            ? item.customPriceRon || 0
            : item.price_eur * exchangeRate;
          return sum + priceRon * item.qty * (item.disc / 100);
        }, 0);
      },

      getTotal: () => {
        const { transport } = get();
        return get().getSubtotal() - get().getDiscount() + transport;
      },

      getTotalEur: () => {
        const { items } = get();
        return items.reduce((sum, item) => {
          if (item.isCustom) return sum;
          return sum + item.price_eur * item.qty * (1 - item.disc / 100);
        }, 0);
      },

      getTotalPoints: () => {
        const { items } = get();
        return items.reduce(
          (sum, item) => sum + (item.points || 0) * item.qty,
          0,
        );
      },

      getCount: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.qty, 0);
      },
    }),
    {
      name: "aromatool-cart",
      partialize: (state) => ({
        items: state.items,
        transport: state.transport,
        clientName: state.clientName,
        clientEmail: state.clientEmail,
        clientPhone: state.clientPhone,
        notes: state.notes,
        exchangeRate: state.exchangeRate,
      }),
    },
  ),
);
