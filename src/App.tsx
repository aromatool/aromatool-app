import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import AuthPage from "./pages/auth/AuthPage";

// Placeholder for main app — va fi înlocuit
function AppPage() {
  const { user, signOut } = useAuth();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FDFAFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        gap: "16px",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "28px",
          color: "#2D1A4E",
        }}
      >
        AromaTool
      </div>
      <div style={{ fontSize: "14px", color: "#9B80C4" }}>
        Bun venit, {user?.user_metadata?.full_name || user?.email}! 🌿
      </div>
      <div style={{ fontSize: "13px", color: "#C4A8E8" }}>
        Aplicația se construiește...
      </div>
      <button
        onClick={signOut}
        style={{
          padding: "8px 20px",
          background: "none",
          border: "1px solid rgba(196,168,232,0.5)",
          borderRadius: "999px",
          fontSize: "13px",
          color: "#9B80C4",
          cursor: "pointer",
          marginTop: "8px",
        }}
      >
        Ieși din cont
      </button>
    </div>
  );
}

// Protected route
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #E8E0F8",
            borderTopColor: "#7B5EA7",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/app" replace /> : <AuthPage />}
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={user ? "/app" : "/auth"} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
