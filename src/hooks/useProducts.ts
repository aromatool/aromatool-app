import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useCompany } from "./useCompany";

export interface Product {
  id: string;
  name: string;
  sku: string;
  points: number;
  // Preț în moneda NATIVĂ a catalogului (vezi `currency`). Numele coloanei
  // e istoric „price_eur”, dar valoarea e EUR doar pentru zona euro; pentru
  // UK e GBP etc. Interpretarea corectă se face mereu prin `currency`.
  price_eur: number;
  // Prețul RETAIL (de listă, mai mare), în aceeași monedă ca `price_eur`.
  // 0 = produs importat înainte de coloana retail → se folosește price_eur.
  retail_price_eur: number;
  // Moneda în care e exprimat `price_eur` (EUR, GBP, ...).
  currency: string;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export function useProducts(countryCode = "RO") {
  const { data: company } = useCompany();
  const companyId = company?.id;
  return useQuery({
    queryKey: ["products", companyId, countryCode],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, points, price_eur, retail_price_eur, currency")
        .eq("company_id", companyId!)
        .eq("country_code", countryCode)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// Țările care AU produse importate pentru compania curentă.
// Folosit pentru a popula selectorul de catalog (fără opțiuni goale).
// Folosește RPC-ul `list_product_countries` (DISTINCT în DB) ca să nu
// dependem de limita de 1000 de rânduri a unui select pe `products`.
export function useProductCountries() {
  const { data: company } = useCompany();
  const companyId = company?.id;
  return useQuery({
    queryKey: ["product-countries", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_product_countries");
      if (error) throw error;
      return ((data ?? []) as { country_code: string }[])
        .map((r) => r.country_code)
        .filter(Boolean);
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useExchangeRate() {
  return useQuery({
    queryKey: ["exchange-rate", "EUR", "RON"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("from_currency", "EUR")
        .eq("to_currency", "RON")
        .single();
      if (error) throw error;
      return data as ExchangeRate;
    },
    staleTime: 1000 * 60 * 60,
  });
}
