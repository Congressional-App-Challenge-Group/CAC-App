"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type SessionState = {
  user: User | null;
  loading: boolean;
  /** Whether Supabase is configured for this environment at all. */
  enabled: boolean;
};

const SessionContext = createContext<SessionState>({ user: null, loading: true, enabled: false });

function readEnabled(): boolean {
  return Boolean(
    typeof window === "undefined" ? false : process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ user: null, loading: true, enabled: readEnabled() });

  useEffect(() => {
    if (!state.enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    let fresh = true;
    let unlisten: (() => void) | null = null;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!fresh) return;
      setState({ user: data.session?.user ?? null, loading: false, enabled: true });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (fresh) setState({ user: session?.user ?? null, loading: false, enabled: true });
      });
      unlisten = () => sub.subscription.unsubscribe();
    })();
    return () => {
      fresh = false;
      unlisten?.();
    };
  }, [state.enabled]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}