"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { UserPreferences } from "@/types";

const DEFAULTS: UserPreferences = {
  zipCode: "28205",
  roles: ["Other resident"],
  interests: ["Public transit", "Housing", "Parks"],
};

const STORAGE = {
  preferences: "civiclens-preferences",
  decisions: "civiclens-following",
  places: "civiclens-following-places",
  personalized: "civiclens-personalization-complete",
};

type PreferencesContextValue = {
  preferences: UserPreferences;
  setPreferences: (preferences: UserPreferences) => void;
  following: string[];
  toggleFollow: (id: string) => void;
  followingPlaces: string[];
  toggleFollowPlace: (key: string) => void;
  ready: boolean;
  source: "local" | "account";
  personalized: boolean;
  dismissPersonalization: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStorage<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The app still works if the browser blocks local storage.
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: sessionLoading, enabled } = useSession();
  const userId = user?.id ?? null;
  const profileKey = userId ?? "guest";

  const [preferences, setPreferenceState] = useState(DEFAULTS);
  const [following, setFollowing] = useState<string[]>([]);
  const [followingPlaces, setFollowingPlaces] = useState<string[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<string | null>(null);
  const [source, setSource] = useState<"local" | "account">("local");
  const [personalized, setPersonalized] = useState(false);

  const ready = !sessionLoading && loadedProfile === profileKey;

  // Load local choices first. Signed-in users then get their saved cloud choices.
  useEffect(() => {
    if (sessionLoading) return;

    let cancelled = false;
    setLoadedProfile(null);

    async function loadProfile() {
      const localPreferences = readStorage<UserPreferences>(STORAGE.preferences);
      const localFollowing = readStorage<string[]>(STORAGE.decisions) ?? [];
      const localPlaces = readStorage<string[]>(STORAGE.places) ?? [];
      const completed = readStorage<boolean>(STORAGE.personalized) === true;

      if (!userId || !enabled) {
        if (cancelled) return;
        setPreferenceState(localPreferences ?? DEFAULTS);
        setFollowing(localFollowing);
        setFollowingPlaces(localPlaces);
        setPersonalized(completed);
        setSource("local");
        setLoadedProfile("guest");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const [preferenceResult, decisionResult, placeResult] = await Promise.all([
        supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("decision_follows").select("decision_id").eq("user_id", userId),
        supabase.from("place_follows").select("place_key").eq("user_id", userId),
      ]);

      if (cancelled) return;

      const row = preferenceResult.data;
      if (row) {
        setPreferenceState({
          zipCode: row.zip_code || DEFAULTS.zipCode,
          roles: row.roles ?? DEFAULTS.roles,
          interests: row.interests ?? DEFAULTS.interests,
        });
        setPersonalized(true);
        writeStorage(STORAGE.personalized, true);
      } else {
        setPreferenceState(localPreferences ?? DEFAULTS);
        setPersonalized(completed);
      }

      setFollowing(
        decisionResult.data?.map((item) => item.decision_id as string) ?? localFollowing,
      );

      const cloudPlaces = placeResult.data?.map((item) => item.place_key as string) ?? [];
      setFollowingPlaces([...new Set([...cloudPlaces, ...localPlaces])]);
      setSource("account");
      setLoadedProfile(userId);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [enabled, profileKey, sessionLoading, userId]);

  // Save every change locally. If signed in, also sync it to Supabase.
  useEffect(() => {
    if (!ready) return;

    writeStorage(STORAGE.preferences, preferences);
    writeStorage(STORAGE.decisions, following);
    writeStorage(STORAGE.places, followingPlaces);

    if (!userId || !enabled) return;

    async function syncAccount() {
      const supabase = createSupabaseBrowserClient();

      await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          zip_code: preferences.zipCode,
          roles: preferences.roles,
          interests: preferences.interests,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      await supabase.from("decision_follows").delete().eq("user_id", userId);
      if (following.length) {
        await supabase.from("decision_follows").insert(
          following.map((decisionId) => ({ user_id: userId, decision_id: decisionId })),
        );
      }

      await supabase.from("place_follows").delete().eq("user_id", userId);
      if (followingPlaces.length) {
        await supabase.from("place_follows").insert(
          followingPlaces.map((placeKey) => ({ user_id: userId, place_key: placeKey })),
        );
      }
    }

    void syncAccount();
  }, [enabled, following, followingPlaces, preferences, ready, userId]);

  const setPreferences = useCallback((next: UserPreferences) => {
    setPreferenceState(next);
    setPersonalized(true);
    writeStorage(STORAGE.personalized, true);
  }, []);

  const dismissPersonalization = useCallback(() => {
    setPersonalized(true);
    writeStorage(STORAGE.personalized, true);
  }, []);

  const toggleFollow = useCallback((id: string) => {
    setFollowing((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const toggleFollowPlace = useCallback((key: string) => {
    setFollowingPlaces((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        setPreferences,
        following,
        toggleFollow,
        followingPlaces,
        toggleFollowPlace,
        ready,
        source,
        personalized,
        dismissPersonalization,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be inside PreferencesProvider");
  return context;
}
