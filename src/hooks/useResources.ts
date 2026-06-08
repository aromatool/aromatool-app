import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface Resource {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  usage_count: number; // în câte linkuri/emailuri a fost folosită
}

// ── Reguli de cost (plafoane) ────────────────────────────────
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB / fișier
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// Quota storage per plan (ușor de ajustat). Ține egress + storage sub control.
// ⚠️ Trebuie ținut în sync cu funcția SQL resource_quota_bytes() din
//    migration 20260610_resource_quota.sql (enforcement pe server).
const MB = 1024 * 1024;
const GB = 1024 * MB;
export const QUOTA_BY_PLAN: Record<string, number> = {
  trial: 50 * MB,
  starter: 500 * MB,
  growth: 2 * GB,
  team: 5 * GB,
  business: 10 * GB,
};
const DEFAULT_QUOTA = 50 * MB;

function extOf(fileType: string): string {
  if (fileType === "application/pdf") return "pdf";
  if (fileType === "image/png") return "png";
  return "jpg";
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export function useResources() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["resources", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Resource[]> => {
      const { data: resources, error } = await supabase
        .from("resources")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Tally folosiri din resource_links (un query, agregare client-side)
      const { data: links } = await supabase
        .from("resource_links")
        .select("resource_id")
        .eq("user_id", user!.id);

      const counts = new Map<string, number>();
      for (const l of links ?? []) {
        counts.set(l.resource_id, (counts.get(l.resource_id) ?? 0) + 1);
      }

      return (resources ?? []).map((r) => ({
        ...r,
        usage_count: counts.get(r.id) ?? 0,
      })) as Resource[];
    },
    staleTime: 1000 * 60,
  });

  const quota = useQuery({
    queryKey: ["resource-quota", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("id", user!.id)
        .single();
      const plan = (profile?.subscription_plan as string) ?? "trial";
      return { plan, bytes: QUOTA_BY_PLAN[plan] ?? DEFAULT_QUOTA };
    },
    staleTime: 1000 * 60 * 5,
  });

  const usedBytes = (list.data ?? []).reduce((s, r) => s + (r.file_size ?? 0), 0);
  const quotaBytes = quota.data?.bytes ?? DEFAULT_QUOTA;
  const plan = quota.data?.plan ?? "trial";

  // ── UPLOAD ─────────────────────────────────────────────────
  const upload = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      if (!user?.id) throw new Error("Neautentificat.");
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Tip neacceptat. Doar PDF, JPG sau PNG.");
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new Error("Fișierul depășește 10 MB.");
      }
      if (usedBytes + file.size > quotaBytes) {
        throw new Error("Ai atins limita de stocare a planului tău.");
      }

      // 1. Creăm întâi rândul ca să avem un id pentru path
      const { data: row, error: insErr } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          title: title.trim() || file.name,
          file_path: "", // completăm imediat
          file_type: file.type,
          file_size: file.size,
        })
        .select("id")
        .single();
      if (insErr || !row) {
        if (insErr?.message?.includes("STORAGE_QUOTA_EXCEEDED")) {
          throw new Error("Ai atins limita de stocare a planului tău.");
        }
        throw insErr ?? new Error("Eroare la salvare.");
      }

      const path = `${user.id}/${row.id}/${sanitizeName(file.name) || `fisier.${extOf(file.type)}`}`;

      // 2. Upload în Storage
      const { error: upErr } = await supabase.storage
        .from("resources")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) {
        // rollback rândul orfan
        await supabase.from("resources").delete().eq("id", row.id);
        throw upErr;
      }

      // 3. Salvăm path-ul
      const { error: updErr } = await supabase
        .from("resources")
        .update({ file_path: path, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;

      return row.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", user?.id] });
    },
  });

  // ── RENAME ─────────────────────────────────────────────────
  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("resources")
        .update({ title: title.trim(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", user?.id] });
    },
  });

  // ── DELETE (DB + Storage) ──────────────────────────────────
  const remove = useMutation({
    mutationFn: async (resource: Resource) => {
      // Storage întâi (fără orfani de bytes)
      if (resource.file_path) {
        await supabase.storage.from("resources").remove([resource.file_path]);
      }
      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources", user?.id] });
    },
  });

  return {
    resources: list.data ?? [],
    loading: list.isLoading,
    error: list.error,
    usedBytes,
    quotaBytes,
    plan,
    upload,
    rename,
    remove,
  };
}
