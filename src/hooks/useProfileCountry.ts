import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

// Țara din profilul distribuitorului (profiles.country_code), folosită
// ca prefix telefonic implicit la adăugarea unui contact nou.
// Cache lung — se schimbă rar. Fallback "RO".
export function useProfileCountry(): string {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["profileCountry", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("country_code")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data?.country_code || "RO";
    },
  });
  return data || "RO";
}
