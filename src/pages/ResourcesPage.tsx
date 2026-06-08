import { useState, useMemo, useRef } from "react";
import {
  useResources,
  MAX_FILE_BYTES,
  ALLOWED_TYPES,
  QUOTA_BY_PLAN,
} from "../hooks/useResources";
import type { Resource } from "../hooks/useResources";
import { useUpgrade } from "../hooks/useUpgrade";

// Ordinea planurilor pentru a sugera următorul upgrade
const PLAN_ORDER = ["trial", "starter", "growth", "team", "business"];
const PLAN_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  team: "Team",
  business: "Business",
};

// ── BLOSSOM SAGE COLORS ───────────────────────────────────
const C = {
  bg: "#FAFAF7",
  card: "#FFFFFF",
  border: "rgba(92,122,92,0.15)",
  border2: "rgba(92,122,92,0.25)",
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  text2: "#6A5A50",
  red: "#C94F6A",
  redbg: "#FFF0F4",
  green: "#2E8A58",
  bg2: "#E8F0E8",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function typeLabel(fileType: string): string {
  if (fileType === "application/pdf") return "PDF";
  if (fileType === "image/png") return "PNG";
  return "JPG";
}

function fileIcon(fileType: string): string {
  return fileType === "application/pdf" ? "ti ti-file-type-pdf" : "ti ti-photo";
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ResourcesPage() {
  const { resources, loading, usedBytes, quotaBytes, plan, upload, rename, remove } =
    useResources();
  const { upgrade, loading: upgrading } = useUpgrade();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => r.title.toLowerCase().includes(q));
  }, [resources, query]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`„${file.name}" nu e acceptat. Doar PDF, JPG sau PNG.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`„${file.name}" depășește 10 MB.`);
        continue;
      }
      try {
        await upload.mutateAsync({ file, title: file.name });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la upload.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(r: Resource) {
    if (!confirm(`Ștergi „${r.title}"? Acțiunea nu poate fi anulată.`)) return;
    try {
      await remove.mutateAsync(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la ștergere.");
    }
  }

  function startRename(r: Resource) {
    setRenamingId(r.id);
    setRenameValue(r.title);
  }

  async function commitRename(id: string) {
    const v = renameValue.trim();
    if (v) {
      try {
        await rename.mutateAsync({ id, title: v });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la redenumire.");
      }
    }
    setRenamingId(null);
  }

  const upgradeParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("upgrade")
      : null;

  const pct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const nearLimit = pct >= 85;
  const idx = PLAN_ORDER.indexOf(plan);
  const nextPlan = idx >= 0 && idx < PLAN_ORDER.length - 1 ? PLAN_ORDER[idx + 1] : null;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "16px" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "24px",
            color: C.dark,
            margin: 0,
          }}
        >
          Resurse
        </h1>
        <p style={{ fontSize: "13px", color: C.muted, marginTop: "4px" }}>
          Materialele tale (PDF, poze) pe care le atașezi în oferte ca linkuri.
        </p>
      </div>

      {upgradeParam === "success" && (
        <div
          style={{
            background: "#E8F8F0",
            border: `1px solid rgba(46,138,88,0.25)`,
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "13px",
            color: C.green,
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          Mulțumim! Plata a fost inițiată — planul se actualizează în câteva
          momente.
        </div>
      )}
      {upgradeParam === "cancel" && (
        <div
          style={{
            background: C.redbg,
            border: `1px solid ${C.red}`,
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "13px",
            color: C.red,
            marginBottom: "12px",
          }}
        >
          Upgrade-ul a fost anulat. Poți reîncerca oricând.
        </div>
      )}

      {/* Storage bar */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border2}`,
          borderRadius: "12px",
          padding: "14px 16px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: C.text2,
            marginBottom: "8px",
          }}
        >
          <span>
            Stocare folosită · plan{" "}
            <strong style={{ color: C.dark }}>{PLAN_LABEL[plan] ?? plan}</strong>
          </span>
          <span>
            {fmtSize(usedBytes)} / {fmtSize(quotaBytes)}
          </span>
        </div>
        <div
          style={{
            height: "6px",
            background: C.bg2,
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct > 90 ? C.red : C.primary,
              transition: "width 0.2s",
            }}
          />
        </div>

        {nearLimit && nextPlan && (
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", color: C.red, flex: 1, minWidth: "160px" }}>
              Aproape ai umplut spațiul. Treci pe {PLAN_LABEL[nextPlan]} (
              {fmtSize(QUOTA_BY_PLAN[nextPlan])}) pentru mai mult.
            </span>
            <button
              onClick={() => upgrade(nextPlan)}
              disabled={upgrading}
              style={{
                background: C.primary,
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                color: "white",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                cursor: upgrading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {upgrading ? "Se deschide..." : `Upgrade la ${PLAN_LABEL[nextPlan]}`}
            </button>
          </div>
        )}
      </div>

      {/* Upload + search */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută după titlu..."
          style={{
            flex: 1,
            padding: "10px 12px",
            background: C.card,
            border: `1.5px solid ${C.border2}`,
            borderRadius: "8px",
            fontSize: "14px",
            color: C.dark,
            fontFamily: "'DM Sans', sans-serif",
            outline: "none",
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          style={{
            background: upload.isPending ? C.muted : C.primary,
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            color: "white",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            cursor: upload.isPending ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          {upload.isPending ? (
            <>
              <i className="ti ti-loader-2" style={{ fontSize: "14px" }} /> Se
              încarcă...
            </>
          ) : (
            <>
              <i className="ti ti-upload" style={{ fontSize: "14px" }} /> Încarcă
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: "none" }}
        />
      </div>

      <div style={{ fontSize: "11px", color: C.muted, marginBottom: "12px" }}>
        <i className="ti ti-info-circle" style={{ fontSize: "12px", marginRight: "4px" }} />
        Tipuri acceptate: PDF, JPG, PNG · maxim 10 MB / fișier
      </div>

      {error && (
        <div
          style={{
            background: C.redbg,
            color: C.red,
            border: `1px solid ${C.red}`,
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>
          Se încarcă...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 16px",
            color: C.muted,
            background: C.card,
            border: `1.5px dashed ${C.border2}`,
            borderRadius: "12px",
          }}
        >
          <i
            className="ti ti-folder-open"
            style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}
          />
          {query
            ? "Nicio resursă găsită."
            : "Încă nu ai resurse. Încarcă primul material."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: C.card,
                border: `1px solid ${C.border2}`,
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            >
              <i
                className={fileIcon(r.file_type)}
                style={{ fontSize: "22px", color: C.primary, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === r.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(r.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "4px 8px",
                      border: `1.5px solid ${C.primary}`,
                      borderRadius: "6px",
                      fontSize: "14px",
                      color: C.dark,
                      fontFamily: "'DM Sans', sans-serif",
                      outline: "none",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: C.dark,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.title}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>
                  {typeLabel(r.file_type)} · {fmtSize(r.file_size)} · folosit în{" "}
                  {r.usage_count} {r.usage_count === 1 ? "email" : "emailuri"} ·
                  adăugat {fmtDate(r.created_at)}
                </div>
              </div>
              <button
                onClick={() => startRename(r)}
                title="Redenumește"
                style={iconBtn}
              >
                <i className="ti ti-pencil" style={{ fontSize: "16px" }} />
              </button>
              <button
                onClick={() => handleDelete(r)}
                title="Șterge"
                style={{ ...iconBtn, color: C.red }}
              >
                <i className="ti ti-trash" style={{ fontSize: "16px" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#A89888",
  display: "flex",
  alignItems: "center",
  padding: "4px",
  flexShrink: 0,
};
