import { useState } from "react";
import { supabase } from "../lib/supabase";

// Pornește un checkout Stripe pentru upgrade-ul planului.
// La succes redirecționează către pagina Stripe.
export function useUpgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upgrade(plan: string) {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "create-checkout",
        { body: { plan } },
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url as string;
        return true;
      }
      throw new Error("Nu am primit linkul de plată.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la upgrade.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { upgrade, loading, error };
}
