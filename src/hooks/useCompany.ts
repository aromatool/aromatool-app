import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

// Config-ul per companie (din companies.config jsonb).
// Controlează ce funcționalități/câmpuri se afișează pentru compania userului.
export interface CompanyConfig {
  features?: Record<string, boolean>;        // ex: { protocols: true, points: true }
  terminology?: Record<string, string>;      // ex: { points: "PV" }
  product_fields?: string[];                 // ce câmpuri afișăm pe produs
  default_country?: string;
  import_source?: { type: string; url?: string };
  branding?: { primary?: string };
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  config: CompanyConfig;
}

// Compania userului curent (din profiles.company_id → companies).
export function useCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["company", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<Company | null> => {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .single();
      if (pErr) throw pErr;
      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from("companies")
        .select("id, slug, name, config")
        .eq("id", profile.company_id)
        .single();
      if (error) throw error;

      return {
        id: data.id,
        slug: data.slug,
        name: data.name,
        config: (data.config ?? {}) as CompanyConfig,
      };
    },
  });
}

// Helper: verifică dacă o funcționalitate e activă pentru compania userului.
export function useFeature(name: string): boolean {
  const { data: company } = useCompany();
  return company?.config?.features?.[name] ?? false;
}
