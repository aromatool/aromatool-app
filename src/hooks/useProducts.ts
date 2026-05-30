import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface Product {
  id: string;
  name: string;
  sku: string;
  points: number;
  price_eur: number;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

export function useProducts(countryCode = "RO") {
  return useQuery({
    queryKey: ["products", countryCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, points, price_eur")
        .eq("country_code", countryCode)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    staleTime: 1000 * 60 * 10,
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
