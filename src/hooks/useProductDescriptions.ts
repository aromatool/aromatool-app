import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useCompany } from "./useCompany";

// Descriere de produs scrisă de lider, cheie pe `sku` (stabil la re-import
// și partajat între cataloagele de țară). Returnăm o hartă sku → text.
export interface ProductDescriptionRow {
  sku: string;
  description: string;
}

export function useProductDescriptions() {
  const { data: company } = useCompany();
  const companyId = company?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["product-descriptions", companyId],
    enabled: !!companyId,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("product_descriptions")
        .select("sku, description")
        .eq("company_id", companyId!);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as ProductDescriptionRow[]) {
        if (row.description?.trim()) map[row.sku] = row.description;
      }
      return map;
    },
  });

  // Salvează (upsert) sau, dacă textul e gol, șterge rândul → descrierea
  // dispare curat din hartă (nu rămâne un rând gol).
  const save = useMutation({
    mutationFn: async ({ sku, description }: ProductDescriptionRow) => {
      if (!companyId) throw new Error("no company");
      const trimmed = description.trim();
      if (!trimmed) {
        const { error } = await supabase
          .from("product_descriptions")
          .delete()
          .eq("company_id", companyId)
          .eq("sku", sku);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("product_descriptions").upsert(
        {
          company_id: companyId,
          sku,
          description: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,sku" },
      );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["product-descriptions", companyId] }),
  });

  return {
    descriptions: query.data ?? {},
    loading: query.isLoading,
    save,
  };
}
