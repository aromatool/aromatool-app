import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // true cât timp userul a venit dintr-un link de resetare parolă.
  recovery: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // Trimite emailul cu link de resetare.
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  // Setează parola nouă (după ce userul a venit din link).
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  // Schimbă adresa de email a contului. Supabase trimite un email de
  // confirmare la noua adresă (și, dacă „Secure email change" e activ, și la
  // cea veche); schimbarea devine efectivă abia după confirmare.
  updateEmail: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Țări suportate la lansare (zona EUR, unde prețul de bază în EUR e valid).
// Detectăm țara din locale-ul browserului; dacă nu e suportată → RO implicit.
// Editabilă oricând din Setări.
const SUPPORTED_COUNTRIES = [
  "RO", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI",
];

function detectCountry(): string {
  try {
    const locales = [
      ...(navigator.languages ?? []),
      navigator.language,
    ].filter(Boolean);
    for (const loc of locales) {
      const region = loc.split("-")[1]?.toUpperCase();
      if (region && SUPPORTED_COUNTRIES.includes(region)) return region;
    }
  } catch {
    // ignore — fallback de mai jos
  }
  return "RO";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Linkul de resetare creează o sesiune + emite PASSWORD_RECOVERY.
      // Marcăm starea ca să afișăm ecranul „setează parolă nouă", nu app-ul.
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // country_code e citit de handle_new_user (vezi migrația
        // 20260621_signup_country.sql) și salvat în profiles.
        // terms_accepted: flag de acceptare a Termenilor + Confidențialității
        // (bifa obligatorie din AuthPage). Trigger-ul set_signup_terms
        // (20260704) pune `terms_accepted_at = now()` pe SERVER — momentul
        // nu vine de la client, deci nu poate fi falsificat.
        data: {
          full_name: fullName,
          country_code: detectCountry(),
          terms_accepted: true,
        },
        // Linkul de confirmare duce înapoi în aplicație (trebuie să fie
        // și în Authentication → URL Configuration → Redirect URLs).
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovery(false);
    return { error };
  };

  const updateEmail = async (email: string) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      // Linkul de confirmare din emailul „Change Email" duce înapoi în
      // aplicație (trebuie să fie și în Authentication → Redirect URLs).
      { emailRedirectTo: `${window.location.origin}/auth` },
    );
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        recovery,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
