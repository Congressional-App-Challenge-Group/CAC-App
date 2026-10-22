/**
 * Last-visit tracking for the watchlist.
 *
 * A timestamp stored on the device only (localStorage) — deliberately not an
 * account field, so the privacy model stays "personalization leaves the
 * device". The Following page compares the change log against this stamp and
 * counts what moved since the visitor last looked. First visit has no stamp:
 * the honest answer is "everything changed at some point", so the counter
 * establishes the baseline instead of reporting a number nobody can verify.
 */

const KEY = "civiclens-last-visit";

export function readLastVisit(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stamp = JSON.parse(raw);
    return typeof stamp === "string" && !Number.isNaN(Date.parse(stamp)) ? stamp : null;
  } catch {
    return null;
  }
}

/** Commits the fresh stamp and returns the previous one (null on first visit). */
export function commitVisit(now = new Date()): string | null {
  const previous = readLastVisit();
  try {
    localStorage.setItem(KEY, JSON.stringify(now.toISOString()));
  } catch {
    /* storage unavailable — counter simply reports the uncommitted state */
  }
  return previous;
}
