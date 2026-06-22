import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { setFollowUpDays, getFollowUpDays } from "../lib/recommendedAction";
import { DEFAULT_FOLLOWUP_DAYS } from "../lib/crmThresholds";

// Intervalul de follow-up setat de distribuitor (profiles.follow_up_days),
// folosit de motorul de acțiuni (recommendedAction / focusToday) ca să decidă
// CÂND un prospect/client „necesită follow-up". Cache lung — se schimbă rar.
//
// Pe lângă returnarea valorii, sincronizează și starea de modul din
// recommendedAction (setFollowUpDays), astfel încât funcțiile pure apelate fără
// argument explicit (getActionType, shortReason etc. din componente diverse)
// să folosească intervalul corect, nu doar default-ul. Fallback: DEFAULT_FOLLOWUP_DAYS.
export function useFollowUpDays(): number {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["followUpDays", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("follow_up_days")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      const n = Number(data?.follow_up_days);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_FOLLOWUP_DAYS;
    },
  });

  // Propagă valoarea în starea de modul, ca toate apelurile pure (inclusiv cele
  // din helperi la nivel de modul, ex. ContactsPage) să fie consecvente.
  useEffect(() => {
    if (data != null) setFollowUpDays(data);
  }, [data]);

  return data ?? getFollowUpDays();
}
