import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: "/app/dashboard", icon: "📊", label: "Dashboard" },
  { path: "/app/contacts", icon: "👥", label: "Contacte" },
  { path: "/app/calculator", icon: "🔍", label: "Calculator" },
  { path: "/app/offers", icon: "📋", label: "Oferte" },
  { path: "/app/templates", icon: "📝", label: "Template-uri" },
];

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FDFAFF",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid rgba(196,168,232,0.3)",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/app/calculator")}
        >
          <svg width="160" height="58" viewBox="0 0 200 72">
            <line
              x1="32"
              y1="16"
              x2="88"
              y2="16"
              stroke="#C4A8E8"
              strokeWidth="1"
            />
            <circle cx="100" cy="16" r="3.5" fill="#7B5EA7" />
            <line
              x1="112"
              y1="16"
              x2="168"
              y2="16"
              stroke="#C4A8E8"
              strokeWidth="1"
            />
            <text
              x="100"
              y="40"
              textAnchor="middle"
              fontFamily="Georgia,serif"
              fontSize="26"
              fill="#4A3270"
            >
              AromaTool
            </text>
            <text
              x="100"
              y="58"
              textAnchor="middle"
              fontFamily="Georgia,serif"
              fontSize="9"
              fontStyle="italic"
              fill="#9B80C4"
              letterSpacing="1.5"
            >
              crafted for your team
            </text>
          </svg>
        </div>

        {/* Nav — desktop */}
        <nav
          style={{
            display: "flex",
            gap: "4px",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
          className="desktop-nav"
        >
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  padding: "7px 14px",
                  border: "none",
                  borderRadius: "8px",
                  background: active ? "#F5F0FF" : "transparent",
                  color: active ? "#4A3270" : "#9B80C4",
                  fontSize: "13px",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F5F0FF",
              border: "1px solid rgba(196,168,232,0.4)",
              borderRadius: "999px",
              padding: "6px 12px 6px 6px",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7B5EA7, #4A3270)",
                color: "white",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initials}
            </div>
            <span
              style={{ fontSize: "13px", color: "#4A3270", fontWeight: 500 }}
            >
              {displayName.split(" ")[0]}
            </span>
            <span style={{ fontSize: "10px", color: "#9B80C4" }}>▼</span>
          </button>

          {showUserMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "44px",
                background: "white",
                border: "1px solid rgba(196,168,232,0.3)",
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(123,94,167,0.15)",
                padding: "8px",
                minWidth: "180px",
                zIndex: 300,
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F5F0FF",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#2D1A4E",
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9B80C4",
                    marginTop: "2px",
                  }}
                >
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => {
                  navigate("/app/settings");
                  setShowUserMenu(false);
                }}
                style={menuItemStyle}
              >
                ⚙️ Setări cont
              </button>
              <button
                onClick={() => {
                  signOut();
                  setShowUserMenu(false);
                }}
                style={{ ...menuItemStyle, color: "#C94F6A" }}
              >
                🚪 Ieși din cont
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main
        style={{
          flex: 1,
          padding: "24px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {children}
      </main>

      {/* MOBILE NAV */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "white",
          borderTop: "1px solid rgba(196,168,232,0.3)",
          display: "flex",
          padding: "8px 0 max(8px, env(safe-area-inset-bottom))",
          zIndex: 100,
        }}
        className="mobile-nav"
      >
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "4px 0",
                cursor: "pointer",
                color: active ? "#7B5EA7" : "#C4A8E8",
              }}
            >
              <span style={{ fontSize: "20px" }}>{item.icon}</span>
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          main { padding: 16px 16px 80px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "none",
  background: "transparent",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#4A3270",
  cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};
