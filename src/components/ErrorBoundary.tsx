import { Component, type ReactNode } from "react";
import i18n from "i18next";

// ── Plasă de siguranță globală ───────────────────────────────
// Dacă orice componentă crapă la randare (o formă neașteptată de date,
// un acces la `undefined` etc.), în loc de ecran alb îi arătăm
// utilizatorului un mesaj prietenos cu buton de reîncărcare.
// E un class component pentru că doar clasele pot prinde erori de
// randare (getDerivedStateFromError / componentDidCatch).

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Texte minime, fără să depindem de încărcarea bundle-ului de traduceri
// (boundary-ul trebuie să funcționeze chiar dacă i18n nu e gata).
const TXT = {
  ro: {
    title: "Ceva nu a mers cum trebuie",
    body: "A apărut o eroare neașteptată. Datele tale sunt în siguranță. Reîncarcă pagina pentru a continua.",
    reload: "Reîncarcă pagina",
  },
  en: {
    title: "Something went wrong",
    body: "An unexpected error occurred. Your data is safe. Reload the page to continue.",
    reload: "Reload page",
  },
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Lăsăm o urmă în consolă pentru depanare (fără date sensibile).
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const lang = (i18n.language || "ro").startsWith("en") ? "en" : "ro";
    const t = TXT[lang];

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#F7F5F0",
          fontFamily: "'DM Sans', sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            background: "#FFFFFF",
            border: "1px solid rgba(92,122,92,0.25)",
            borderRadius: 16,
            padding: "32px 28px",
            boxShadow: "0 8px 30px rgba(61,53,48,0.08)",
          }}
        >
          <i
            className="ti ti-mood-sad"
            style={{ fontSize: 40, color: "#5C7A5C", display: "block", marginBottom: 12 }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#3D3530", margin: "0 0 8px" }}>
            {t.title}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6A5A50", margin: "0 0 20px" }}>
            {t.body}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: "#5C7A5C",
              border: "none",
              borderRadius: 10,
              padding: "11px 22px",
              color: "white",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.reload}
          </button>
        </div>
      </div>
    );
  }
}
