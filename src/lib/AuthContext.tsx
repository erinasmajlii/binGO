import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const GUEST_STORAGE_KEY = "bingo:auth:guest-mode:v1";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True while the initial session restore from storage is in flight. */
  isLoading: boolean;
  /** True once the user has explicitly chosen to browse without signing in. */
  isGuest: boolean;
  /** True if there's a real session OR the user chose guest mode. */
  isAuthenticated: boolean;
  displayName: string;
  /** Stable per-user key used for AsyncStorage-scoped local data (captures, missions, etc). */
  userKey: string;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let mounted = true;

    const restoreGuestFlag = AsyncStorage.getItem(GUEST_STORAGE_KEY)
      .then((value) => {
        if (mounted && value === "true") {
          setIsGuest(true);
        }
      })
      .catch(() => {
        // Guest mode just won't be remembered this launch — not fatal.
      });

    if (!supabase) {
      restoreGuestFlag.finally(() => {
        if (mounted) setIsLoading(false);
      });
      return;
    }

    const restoreSession = supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    Promise.all([restoreGuestFlag, restoreSession]).finally(() => {
      if (mounted) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_STORAGE_KEY).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  const value = useMemo<AuthContextValue>(() => {
    const displayName =
      (user?.user_metadata?.name as string | undefined) ||
      user?.email?.split("@")[0] ||
      "Guest";
    const userKey = user?.id || user?.email || "guest";

    return {
      session,
      user,
      isLoading,
      isGuest,
      isAuthenticated: Boolean(user) || isGuest,
      displayName,
      userKey,
      continueAsGuest: () => {
        setIsGuest(true);
        AsyncStorage.setItem(GUEST_STORAGE_KEY, "true").catch(() => {});
      },
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_STORAGE_KEY).catch(() => {});
      },
    };
  }, [session, isLoading, isGuest, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within an <AuthProvider>");
  }
  return ctx;
}
