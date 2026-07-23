"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  /** True until the first getSession() resolves — lets consumers avoid a
   * signed-out flash while auth state is still loading. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

/**
 * One shared client-side auth subscription for the whole app. Before this,
 * six separate components (the four header nav islands, AuthStatus,
 * RoleOnboarding, plus HomeRedirect on the homepage) each ran their own
 * independent `supabase.auth.getSession()` call and `onAuthStateChange`
 * subscription — the same session check repeated up to six times on every
 * single page load, which was a real contributor to slow navigation.
 *
 * Deliberately still client-side rather than reading auth state in a
 * server component here in the root layout: doing that would force every
 * static page on the site, including the public marketing homepage and
 * every calculator under /tools, into dynamic per-request rendering just
 * to know whether the header should say "Sign in." The brief loading
 * state before this resolves is the right tradeoff for keeping the rest
 * of the site fully static (see AuthStatus's original comment, which made
 * the same call before this consolidation).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
