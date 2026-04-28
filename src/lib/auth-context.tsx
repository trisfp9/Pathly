"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Profile } from "@/types";
import { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

// Helper: wrap any promise with a timeout that resolves to a fallback instead of hanging.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // Race against a timeout so a stale connection can never hang the app.
    // If it times out, keep whatever profile we already have (better than null-stuck)
    // and schedule a single retry.
    try {
      const query = supabase.from("profiles").select("*").eq("id", userId).single().then((r) => r) as Promise<{ data: Profile | null; error: Error | null }>;
      const result = await withTimeout(
        query,
        6000,
        { data: null, error: new Error("timeout") }
      );
      if (result.data) {
        setProfile(result.data as Profile);
      } else {
        // Only null-out profile if we've never had one. Otherwise keep stale data
        // and retry in the background.
        setProfile((prev) => prev ?? null);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          void fetchProfile(userId);
        }, 2500);
      }
    } catch {
      setProfile((prev) => prev ?? null);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    window.location.href = "/auth?mode=signin";
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    // HARD SAFETY: no matter what, flip loading off within 4s of mount.
    // Prevents the "stuck on loading forever" bug when getSession() hangs
    // on a stale refresh token.
    const hardTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);

    const init = async () => {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        3500,
        { data: { session: null } } as { data: { session: Session | null } }
      );
      const s = data.session;
      if (cancelled) return;
      if (s?.user) {
        setUser(s.user);
        setSession(s);
        await fetchProfile(s.user.id);
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // When the tab becomes visible again after being idle, proactively refresh
    // the session AND re-fetch the profile so stale state doesn't leave the UI
    // stuck on a skeleton.
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { data } = await withTimeout(
          supabase.auth.refreshSession(),
          4000,
          { data: { session: null, user: null } } as { data: { session: Session | null; user: User | null } }
        );
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          await fetchProfile(data.session.user.id);
        }
      } catch {
        // refresh failed — onAuthStateChange will fire SIGNED_OUT if the session is truly dead
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(hardTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
