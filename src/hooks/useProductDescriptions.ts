import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

// Descriere de produs scrisă de FIECARE utilizator pentru el însuși, cheie pe
// `sku` (stabil la re-import și partajat între cataloagele de țară). Scope pe
// `user_id` — descrierile sunt PRIVATE per cont, NU se văd între utilizatori.
// Returnăm o hartă sku → text.
export interface ProductDescriptionRow {
  sku: string;
  description: string;
}

export function useProductDescriptions() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["product-descriptions", userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("product_descriptions")
        .select("sku, description")
        .eq("user_id", userId!);
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
      if (!userId) throw new Error("no user");
      const trimmed = description.trim();
      if (!trimmed) {
        const { error } = await supabase
          .from("product_descriptions")
          .delete()
          .eq("user_id", userId)
          .eq("sku", sku);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("product_descriptions").upsert(
        {
          user_id: userId,
          sku,
          description: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sku" },
      );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["product-descriptions", userId] }),
  });

  return {
    descriptions: query.data ?? {},
    loading: query.isLoading,
    save,
  };
}
