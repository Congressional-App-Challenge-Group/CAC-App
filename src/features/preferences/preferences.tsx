"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  const [preferences, setPreferenceState] = useState(DEFAULTS);
  const [following, setFollowing] = useState<string[]>([]);
  const [followingPlaces, setFollowingPlaces] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [personalized, setPersonalized] = useState(false);

  // Personalization is intentionally device-local: no account or network request is required.
  useEffect(() => {
    setPreferenceState(readStorage<UserPreferences>(STORAGE.preferences) ?? DEFAULTS);
    setFollowing(readStorage<string[]>(STORAGE.decisions) ?? []);
    setFollowingPlaces(readStorage<string[]>(STORAGE.places) ?? []);
    setPersonalized(readStorage<boolean>(STORAGE.personalized) === true);
    setReady(true);
  }, []);

  // Save every change locally after the initial browser-storage read completes.
  useEffect(() => {
    if (!ready) return;

    writeStorage(STORAGE.preferences, preferences);
    writeStorage(STORAGE.decisions, following);
    writeStorage(STORAGE.places, followingPlaces);
  }, [following, followingPlaces, preferences, ready]);

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
