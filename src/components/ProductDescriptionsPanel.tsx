import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProducts } from "../hooks/useProducts";
import { useProductDescriptions } from "../hooks/useProductDescriptions";
import { useProfileCountry } from "../hooks/useProfileCountry";
import type { Product } from "../hooks/useProducts";

// ── BLOSSOM SAGE COLORS (identice cu ResourcesPage) ──────────
const C = {
  card: "#FFFFFF",
  border2: "rgba(92,122,92,0.25)",
  primary: "#5C7A5C",
  dark: "#3D3530",
  muted: "#A89888",
  text2: "#6A5A50",
  green: "#2E8A58",
  bg2: "#E8F0E8",
};

const MAX_DESC = 1000;

export default function ProductDescriptionsPanel() {
  const { t } = useTranslation();
  const country = useProfileCountry();
  const { data: products = [], isLoading: loadingProducts } = useProducts(country);
  const { descriptions, loading: loadingDesc, save } = useProductDescriptions();

  const [query, setQuery] = useState("");
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingSku, setSavingSku] = useState<string | null>(null);

  // Deduplicăm pe sku (același produs poate exista în mai multe cataloage de
  // țară, dar descrierea e partajată pe sku) și sortăm: întâi cele cu
  // descriere, apoi alfabetic.
  const list = useMemo(() => {
    const seen = new Set<string>();
    const out: Product[] = [];
    for (const p of products) {
      if (!p.sku || p.sku === "CUSTOM" || seen.has(p.sku)) continue;
      seen.add(p.sku);
      out.push(p);
    }
    const q = query.trim().toLowerCase();
    const filtered = q ? out.filter((p) => p.name.toLowerCase().includes(q)) : out;
    return filtered.sort((a, b) => {
      const ha = descriptions[a.sku] ? 0 : 1;
      const hb = descriptions[b.sku] ? 0 : 1;
      if (ha !== hb) return ha - hb;
      return a.name.localeCompare(b.name);
    });
  }, [products, query, descriptions]);

  function startEdit(p: Product) {
    setEditingSku(p.sku);
    setDraft(descriptions[p.sku] || "");
  }

  async function commit(sku: string) {
    setSavingSku(sku);
    try {
      await save.mutateAsync({ sku, description: draft });
      setEditingSku(null);
    } finally {
      setSavingSku(null);
    }
  }

  const loading = loadingProducts || loadingDesc;

  return (
    <div>
      {/* Hint */}
      <div style={{ fontSize: "12px", color: C.text2, marginBottom: "12px", lineHeight: 1.5 }}>
        <i className="ti ti-info-circle" style={{ fontSize: "13px", marginRight: "5px" }} />
        {t("resources.descHint")}
      </div>

      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("resources.descSearchPlaceholder")}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: C.card,
          border: `1.5px solid ${C.border2}`,
          borderRadius: "8px",
          fontSize: "14px",
          color: C.dark,
          fontFamily: "'DM Sans', sans-serif",
          outline: "none",
          boxSizing: "border-box",
          marginBottom: "12px",
        }}
      />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>
          {t("resources.loading")}
        </div>
      ) : list.length === 0 ? (
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
          <i className="ti ti-package" style={{ fontSize: "32px", display: "block", marginBottom: "8px" }} />
          {query ? t("resources.noResults") : t("resources.descNoProducts")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {list.map((p) => {
            const has = !!descriptions[p.sku];
            const isEditing = editingSku === p.sku;
            return (
              <div
                key={p.sku}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border2}`,
                  borderRadius: "10px",
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                  onClick={() => (isEditing ? setEditingSku(null) : startEdit(p))}
                >
                  <i
                    className={has ? "ti ti-circle-check-filled" : "ti ti-circle-plus"}
                    style={{ fontSize: "20px", color: has ? C.green : C.muted, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      {p.name}
                    </div>
                    {has && !isEditing && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: C.muted,
                          marginTop: "2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {descriptions[p.sku]}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: C.primary,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {has ? t("resources.descEdit") : t("resources.descAdd")}
                  </span>
                </div>

                {isEditing && (
                  <div style={{ marginTop: "10px" }}>
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={t("resources.descPlaceholder")}
                      rows={4}
                      maxLength={MAX_DESC}
                      style={{
                        width: "100%",
                        minHeight: "96px",
                        padding: "10px 12px",
                        background: "#FAFAF7",
                        border: `1.5px solid ${C.border2}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                        lineHeight: 1.6,
                        color: C.dark,
                        fontFamily: "'DM Sans', sans-serif",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginTop: "8px",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: C.muted }}>
                        {draft.length} / {MAX_DESC}
                      </span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => setEditingSku(null)}
                          style={{
                            background: "none",
                            border: `1px solid ${C.border2}`,
                            borderRadius: "8px",
                            padding: "8px 14px",
                            color: C.text2,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {t("resources.descCancel")}
                        </button>
                        <button
                          onClick={() => commit(p.sku)}
                          disabled={savingSku === p.sku}
                          style={{
                            background: C.primary,
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 16px",
                            color: "white",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: savingSku === p.sku ? "not-allowed" : "pointer",
                          }}
                        >
                          {savingSku === p.sku ? t("resources.descSaving") : t("resources.descSave")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
