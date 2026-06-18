import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import { SubscriptionProvider } from "./lib/subscription";
import AuthPage from "./pages/auth/AuthPage";
import AppLayout from "./components/AppLayout";
import CalculatorPage from "./pages/CalculatorPage";
import SettingsPage from "./pages/SettingsPage";
import OffersPage from "./pages/OffersPage";
import ContactsPage from "./pages/ContactsPage";
import TemplatesPage from "./pages/TemplatesPage";
import DashboardPage from "./pages/DashboardPage";
import ResourcesPage from "./pages/ResourcesPage";
import HelpPage from "./pages/HelpPage";
import AdminPage from "./pages/AdminPage";
import { PrivacyPage, TermsPage, CookiePage } from "./pages/legal/Legal";
import UnsubscribePage from "./pages/UnsubscribePage";
import ComingSoonPage from "./pages/ComingSoonPage";
import type { ReactNode } from "react";

const queryClient = new QueryClient();

// Gate „coming soon": activ pe getaromatool.com (cu flag VITE_COMING_SOON)
// SAU forțat manual cu ?coming-soon (pentru preview). Pe app.aromatool.com /
// *.vercel.app rămâne app-ul complet. Paginile /legal/* rămân accesibile.
const COMING_SOON =
  (import.meta.env.VITE_COMING_SOON === "true" &&
    /(^|\.)getaromatool\.com$/i.test(window.location.hostname)) ||
  new URLSearchParams(window.location.search).has("coming-soon");

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
  const { user, loading, recovery } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          user && !recovery ? (
            <Navigate to="/app/dashboard" replace />
          ) : (
            <AuthPage />
          )
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
              <ContactsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/offers"
        element={
          <ProtectedRoute>
            <AppLayout>
              <OffersPage />
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
        path="/app/resources"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ResourcesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/templates"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TemplatesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/help"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HelpPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/admin"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AdminPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* Dezabonare — publică (link din emailuri) */}
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
      {/* Pagini legale — publice */}
      <Route path="/legal/privacy" element={<PrivacyPage />} />
      <Route path="/legal/terms" element={<TermsPage />} />
      <Route path="/legal/cookies" element={<CookiePage />} />
      <Route
        path="*"
        element={<Navigate to={user ? "/app/dashboard" : "/auth"} replace />}
      />
    </Routes>
  );
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <AppRoutes />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

// Router minimal pentru coming-soon: landing pe „*", dar păstrăm
// paginile legale accesibile (link din formularul de consimțământ).
function ComingSoonRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/cookies" element={<CookiePage />} />
        <Route path="*" element={<ComingSoonPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  if (COMING_SOON) return <ComingSoonRoutes />;
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWithAuth />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
