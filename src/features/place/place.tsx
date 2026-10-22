"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MapPin, Search, X } from "lucide-react";
import { describePlace, placeKey, type PlaceDistrict } from "@/lib/place";
import { FollowPlaceButton } from "@/features/place/follow";
import { usePreferences } from "@/features/preferences/preferences";
import { Surface } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * The reader's own place.
 *
 * A place is a resolved address: the point the county has on file, plus every
 * district that contains it. It is stored locally beside the other preferences,
 * and it is never inferred — the only way to set one is to type an address that
 * the county's own address file confirms.
 *
 * Deliberately *not* geolocation. Asking for a device location would place a
 * reader wherever their phone happens to be, which is not where they vote, pay
 * taxes, or send their children to school.
 */

const PLACE_KEY = "civiclens-place";

export type StoredPlace = {
  /** What the reader typed. */
  address: string;
  /** What the county's address file says the address is. */
  matchedAddress: string;
  latitude: number;
  longitude: number;
  zipCode?: string;
  districts: PlaceDistrict[];
  resolvedAt: string;
};

type Ctx = {
  place: StoredPlace | null;
  setPlace: (place: StoredPlace | null) => void;
  ready: boolean;
};

const PlaceContext = createContext<Ctx | null>(null);

function read(): StoredPlace | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPlace;
    return Array.isArray(parsed?.districts) ? parsed : null;
  } catch {
    return null;
  }
}

export function PlaceProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlaceState] = useState<StoredPlace | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlaceState(read());
    setReady(true);
  }, []);

  const setPlace = useCallback((next: StoredPlace | null) => {
    setPlaceState(next);
    try {
      if (next) localStorage.setItem(PLACE_KEY, JSON.stringify(next));
      else localStorage.removeItem(PLACE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return <PlaceContext.Provider value={{ place, setPlace, ready }}>{children}</PlaceContext.Provider>;
}

export function usePlace() {
  const value = useContext(PlaceContext);
  if (!value) throw new Error("PlaceProvider missing");
  return value;
}

/* -------------------------------------------------------------------------- */
/* Finder                                                                      */
/* -------------------------------------------------------------------------- */

type LookupResponse =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      matchedAddress: string;
      zipCode?: string;
      districts: PlaceDistrict[];
      sourceUrl: string;
    }
  | { ok: false; reason: string; message: string; candidates?: string[] };

/**
 * The address finder.
 *
 * Every failure mode is spelled out rather than collapsed into "no results",
 * because they mean different things to the reader: a typo, an address the
 * county has never recorded, a street that exists in two directions, and an
 * unreachable server all need different next steps.
 */
export function PlaceFinder({ compact = false }: { compact?: boolean }) {
  const { place, setPlace } = usePlace();
  const { setPreferences, preferences, ready } = usePreferences();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [error, setError] = useState<LookupResponse & { ok: false } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = value.trim();
    if (!address || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/place", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const result = (await response.json()) as LookupResponse;

      if (!result.ok) {
        setError(result);
        return;
      }

      setPlace({
        address,
        matchedAddress: result.matchedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        zipCode: result.zipCode,
        districts: result.districts,
        resolvedAt: new Date().toISOString(),
      });

      // Keep the ZIP surfaces in step with the address the reader just confirmed.
      if (result.zipCode && ready) {
        setPreferences({ ...preferences, zipCode: result.zipCode });
      }
    } catch {
      setError({
        ok: false,
        reason: "upstream-unavailable",
        message: "The lookup could not be reached. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface className={cn("p-5", compact && "p-4")}>
      <form onSubmit={submit}>
        <label
          htmlFor="place-address"
          className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle"
        >
          <MapPin size={13} className="text-civic" aria-hidden="true" />
          Your address
        </label>
        <p className="mt-2 text-sm leading-6 text-muted">
          Look up which districts you live in, using the county&apos;s own address file. Your address
          is not stored on our servers.
        </p>        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="place-address"

            className="field"
            // A real address from the county's own file. A placeholder that fails
            // its own lookup teaches a first-time reader that the feature is
            // broken.
            placeholder="12689 Overlook Mountain Dr, Charlotte"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete="street-address"
            enterKeyHint="search"
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !value.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {busy ? "Looking up" : "Look up"}
          </button>
        </div>

        {/* Optional device-position lookup. Never required: the typed address
            stays fully functional, the request happens only on this explicit
            press, and every failure mode is stated in words rather than
            collapsing into silence. Coordinates go to CivicLens's own resolver
            only, in a POST body, and are never stored. */}
        <div className="mt-2">
          <button
            type="button"
            className="text-xs font-extrabold text-civic transition-colors hover:text-civic-strong disabled:opacity-60"
            disabled={locating}
            onClick={() => {
              if (locating) return;
              if (typeof navigator === "undefined" || !navigator.geolocation) {
                setLocationNote("This browser does not offer device location. Typing the address always works.");
                return;
              }
              setLocating(true);
              setLocationNote(null);
              navigator.geolocation.getCurrentPosition(
                async (position) => {
                  try {
                    const response = await fetch("/api/place", {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                      }),
                    });
                    const result = (await response.json()) as LookupResponse & { anchoredWithinMeters?: number };
                    if (!result.ok) {
                      setError(result);
                      return;
                    }
                    setPlace({
                      address: result.matchedAddress,
                      matchedAddress: result.matchedAddress,
                      latitude: result.latitude,
                      longitude: result.longitude,
                      zipCode: result.zipCode,
                      districts: result.districts,
                      resolvedAt: new Date().toISOString(),
                    });
                    if (result.zipCode && ready) {
                      setPreferences({ ...preferences, zipCode: result.zipCode });
                    }
                    setLocationNote(
                      result.anchoredWithinMeters !== undefined
                        ? `Matched to the county-record address within about ${result.anchoredWithinMeters} m of that position.`
                        : null,
                    );
                  } catch {
                    setLocationNote("The lookup could not be reached. Try typing the address instead.");
                  } finally {
                    setLocating(false);
                  }
                },
                (positionError) => {
                  setLocating(false);
                  setLocationNote(
                    positionError.code === positionError.PERMISSION_DENIED
                      ? "Location permission was declined — that is fine. Type your address above."
                      : positionError.code === positionError.POSITION_UNAVAILABLE
                        ? "The device position is unavailable right now. Type your address above."
                        : "The device took too long to respond. Type your address above.",
                  );
                },
                { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
              );
            }}
          >
            {locating ? "Locating…" : "Use my device location instead"}
          </button>
          <p className="mt-1 text-[11px] leading-4 text-subtle">
            Optional. Asks your browser for permission first; nothing is stored, and where you
            happen to be standing is not where you vote — typing your address gives the precise result.
          </p>
          {locationNote ? (
            <p className="mt-1 text-[11px] leading-4 text-muted" role="status">{locationNote}</p>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded-[var(--radius)] border border-danger/30 bg-danger/5 p-3 text-sm">
          <p className="font-extrabold text-danger">We could not find that address</p>
          <p className="mt-1 leading-6 text-ink-soft">{error.message}</p>
          {error.candidates?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {error.candidates.map((candidate) => (
                <li key={candidate}>{candidate}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {place ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-civic/25 bg-civic/5 px-3 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-ink-soft">
            <Check size={13} className="text-civic" aria-hidden="true" />
            Using {place.matchedAddress}
          </span>
          <button
            type="button"
            onClick={() => setPlace(null)}
            className="flex items-center gap-1 font-extrabold text-muted transition-colors hover:text-ink"
          >
            <X size={12} aria-hidden="true" />
            Clear
          </button>
        </div>
      ) : null}
    </Surface>
  );
}

/* -------------------------------------------------------------------------- */
/* Presentation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The districts a place falls in, with whoever represents it.
 *
 * The representative name and city email come from the same county layer as the
 * boundary, so a reader can check the claim against the source rather than
 * trusting the label.
 */
export function DistrictList({ districts }: { districts: PlaceDistrict[] }) {
  if (!districts.length) {
    return (
      <p className="text-sm leading-6 text-muted">
        Your address is not inside any district layer CivicLens has loaded. That usually means it is
        outside Mecklenburg County, or in an area the county does not publish a boundary for.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {districts.map((district) => (
        <li key={placeKey(district.kind, district.code)} className="surface-flat p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-subtle">
            {district.label.replace(/\s\d+$/, "")}
          </p>
          <p className="mt-1.5 text-sm font-black text-ink">{district.label}</p>
          {district.rep ? (
            <p className="mt-1.5 text-xs text-ink-soft">Represented by {district.rep}</p>
          ) : null}
          {district.email ? (
            <a
              href={`mailto:${district.email}`}
              className="mt-1 inline-block break-all text-xs font-bold text-civic hover:text-civic-strong"
            >
              {district.email}
            </a>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <FollowPlaceButton district={district} />
            <Link
              href={`/places/${district.kind}/${district.code}`}
              className="text-xs font-extrabold text-civic hover:text-civic-strong"
            >
              Everything here
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A one-line summary of where the reader is, for a heading. */
export function PlaceSummary({ place }: { place: StoredPlace }) {
  return (
    <span className="font-bold text-ink-soft">
      {describePlace(place.districts) || `ZIP ${place.zipCode ?? "unknown"}`}
    </span>
  );
}
