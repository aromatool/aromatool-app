import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import AuthPage from "./pages/auth/AuthPage";
import AppLayout from "./components/AppLayout";
import CalculatorPage from "./pages/CalculatorPage";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

function PlaceholderPage({ title, icon }: { title: string; icon: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        color: "#9B80C4",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "48px" }}>{icon}</div>
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "22px",
          color: "#4A3270",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "13px" }}>Se construiește... 🌿</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDFAFF",
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        element={
          user ? <Navigate to="/app/calculator" replace /> : <AuthPage />
        }
      />
      <Route
        path="/app/calculator"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CalculatorPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/contacts"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Clienți" icon="👥" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/offers"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Oferte" icon="📋" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/protocols"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Protocoale" icon="📖" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Dashboard" icon="📊" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PlaceholderPage title="Setări" icon="⚙️" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={user ? "/app/calculator" : "/auth"} replace />}
      />
    </Routes>
  );
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWithAuth />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
