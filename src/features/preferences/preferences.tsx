"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { UserPreferences } from "@/types";
import { useSession } from "@/components/session-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const defaults: UserPreferences = { zipCode: "28205", roles: ["Other resident"], interests: ["Public transit", "Housing", "Parks"] };
const PREFS_KEY = "civiclens-preferences";
const FOLLOW_KEY = "civiclens-following";

type Ctx = {
  preferences: UserPreferences;
  setPreferences: (p: UserPreferences) => void;
  following: string[];
  toggleFollow: (id: string) => void;
  ready: boolean;
  source: "local" | "account";
};

const PreferencesContext = createContext<Ctx | null>(null);

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: sessionLoading, enabled } = useSession();
  const userId = user?.id ?? null;
  const accountMode = Boolean(userId && enabled && !sessionLoading);

  const [preferences, setP] = useState<UserPreferences>(defaults);
  const [following, setFollowing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<Ctx["source"]>("local");

  // True until the first hydration of the current profile has completed.
  const hydratedRef = useRef(false);
  // Which profile (userId or "guest") we hydrated, so a different account re-hydrates.
  const hydratedForRef = useRef<string | null>(null);
  // Monotonic generation counter: bumped when a hydration starts, snapshotted
  // only once that hydration completes. Prevents persisting stale state from a
  // previous profile under a new userId before the new profile is loaded.
  const hydrationStartGenRef = useRef(0);
  const hydrationDoneGenRef = useRef(0);

  // Hydrate once: account prefs when signed in, otherwise local guest prefs.
  useEffect(() => {
    const profileKey = accountMode ? userId : "guest";
    if (hydratedRef.current && hydratedForRef.current === profileKey) return;
    hydratedRef.current = false;
    hydratedForRef.current = profileKey;
    // Mark a new hydration in flight so the persist effect stays quiet until it lands.
    hydrationStartGenRef.current += 1;
    const startGen = hydrationStartGenRef.current;
    let fresh = true;
    (async () => {
      if (accountMode) {
        const supabase = createSupabaseBrowserClient();
        const localPrefs = safeGet<UserPreferences>(PREFS_KEY);
        const [{ data: prefRow }, { data: followRows }] = await Promise.all([
          supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("decision_follows").select("decision_id").eq("user_id", userId),
        ]);
        if (!fresh) return;
        if (prefRow) {
          setP({
            zipCode: prefRow.zip_code || defaults.zipCode,
            roles: prefRow.roles ?? defaults.roles,
            interests: prefRow.interests ?? defaults.interests,
          });
          setFollowing((followRows ?? []).map((r) => r.decision_id as string));
        } else {
          // New account: seed from any local guest preferences so nothing is lost.
          if (localPrefs) setP((prev) => ({ ...prev, ...localPrefs }));
          setFollowing(safeGet<string[]>(FOLLOW_KEY) ?? []);
        }
        setSource("account");
      } else {
        const localPrefs = safeGet<UserPreferences>(PREFS_KEY);
        const localFollows = safeGet<string[]>(FOLLOW_KEY);
        if (!fresh) return;
        if (localPrefs) setP((prev) => ({ ...prev, ...localPrefs }));
        if (localFollows) setFollowing(localFollows);
        setSource("local");
      }
      if (!fresh) return;
      hydratedRef.current = true;
      hydrationDoneGenRef.current = Math.max(hydrationDoneGenRef.current, startGen);
      setReady(true);
    })();
    return () => {
      fresh = false;
    };
  }, [accountMode, userId]);

  // Persist on every change once the current profile's hydration has completed.
  // The generation guard prevents a stale write from a prior/previous account.
  useEffect(() => {
    const currentStart = hydrationStartGenRef.current;
    const currentDone = hydrationDoneGenRef.current;
    if (!ready || currentDone < currentStart) return;
    safeSet(PREFS_KEY, preferences);
    safeSet(FOLLOW_KEY, following);
    if (!accountMode) return;
    const supabase = createSupabaseBrowserClient();
    void supabase
      .from("user_preferences")
      .upsert(
        { user_id: userId, zip_code: preferences.zipCode, roles: preferences.roles, interests: preferences.interests, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    void supabase.from("decision_follows").delete().eq("user_id", userId);
    if (following.length) {
      void supabase.from("decision_follows").insert(following.map((decisionId) => ({ user_id: userId, decision_id: decisionId })));
    }
  }, [preferences, following, ready, accountMode, userId]);

  const setPreferences = useCallback((prefs: UserPreferences) => setP(prefs), []);
  const toggleFollow = useCallback((id: string) => {
    setFollowing((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id]));
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences, following, toggleFollow, ready, source }}>{children}</PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("PreferencesProvider missing");
  return value;
};
