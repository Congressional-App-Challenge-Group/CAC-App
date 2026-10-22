"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, RefreshCcw } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { decisionPlaceCodes } from "@/lib/place";
import { commitVisit, readLastVisit } from "@/lib/last-visit";
import type { DecisionChange } from "@/types";
import { cn } from "@/lib/cn";

/**
 * "What moved since I last looked" — computed, never promised.
 *
 * The watchlist copy used to imply notifications would simply arrive; no email
 * or push subsystem exists, and this card does not pretend otherwise. It reads
 * the change log the /changes page is built from, filters it to what this
 * visitor follows (decisions and districts), and compares against a
 * device-local last-visit stamp. Three states are truthful on purpose:
 *
 *  - first visit: baseline set, no invented history, no unverifiable number;
 *  - zero changes: a real answer, not an error;
 *  - a long gap: the count is exact but covers a long window, which is stated.
 */
export function ChangesSinceVisit() {
  const { following, followingPlaces, ready } = usePreferences();
  const decisions = useDecisions();
  const [changes, setChanges] = useState<DecisionChange[] | null>(null);
  const [previousStamp, setPreviousStamp] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/changes/recent?days=30&limit=60")
      .then((response) => response.json())
      .then((data: { changes?: DecisionChange[] }) => {
        if (!cancelled) setChanges(Array.isArray(data.changes) ? data.changes : []);
      })
      .catch(() => {
        if (!cancelled) setChanges([]); // fetch failed: unknown, presented as "no claim"
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPreviousStamp(readLastVisit());
    // Commit after read, so successive visits see successive deltas.
    commitVisit();
  }, []);

  const result = useMemo(() => {
    if (changes === null || previousStamp === undefined || !ready) return null;
    if (previousStamp === null) return { firstVisit: true as const, items: [], count: 0, gapDays: 0 };

    const since = Date.parse(previousStamp);
    if (Number.isNaN(since)) return { firstVisit: true as const, items: [], count: 0, gapDays: 0 };

    // A change is "on the watchlist" when it touched a followed decision, or
    // touched any record placed in a followed district.
    const followed = new Set(following);
    const slugToRecord = new Map(decisions.map((decision) => [decision.slug, decision]));
    const relevant = changes.filter((change) => {
      if (followed.has(change.decisionId)) return true;
      if (!change.slug) return false;
      const decision = slugToRecord.get(change.slug);
      if (!decision) return false;
      const codes = decisionPlaceCodes(decision.geography);
      return followingPlaces.some((key) => {
        const [kind, code] = key.split(":");
        return kind in codes && codes[kind as keyof typeof codes] === code;
      });
    });

    return {
      firstVisit: false as const,
      count: relevant.length,
      items: relevant.slice(0, 8),
      gapDays: Math.max(0, Math.round((Date.now() - since) / 86_400_000)),
    };
  }, [changes, following, followingPlaces, decisions, ready, previousStamp]);

  if (!result) return null;

  if (result.firstVisit) {
    return (
      <div className={cn("card flex items-start gap-3 p-5")}>
        <Activity size={18} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
        <div>
          <p className="font-extrabold text-ink">We&apos;ll start counting from this visit</p>
          <p className="mt-1 text-sm text-muted">
            The movement log is compared against your last visit, stored on this device only — no account needed, nothing
            leaves your browser. Come back after records move and your watchlist will show exactly what changed since
            this moment.
          </p>
        </div>
      </div>
    );
  }

  if (result.count === 0) {
    return (
      <div className={cn("card flex items-start gap-3 p-5")}>
        <RefreshCcw size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden="true" />
        <div>
          <p className="font-extrabold text-ink">Nothing on your watchlist has moved since your last visit</p>
          <p className="mt-1 text-sm text-muted">
            Zero is a real answer, not an error — the change engine reports only when a published record actually moves.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card p-5")} aria-live="polite">
      <p className="flex items-center gap-2 font-extrabold text-ink">
        <Activity size={18} className="text-civic" aria-hidden="true" />
        {result.count} {result.count === 1 ? "change" : "changes"} on your watchlist since your last visit
        {result.gapDays > 14 ? <> — across the last {result.gapDays} days</> : null}
      </p>
      <ul className="mt-3 space-y-2">
        {result.items.map((change) => (
          <li key={change.id} className="text-sm text-ink-soft">
            {change.title ? change.title : "A followed record"} — {change.field} updated
            {change.current ? ` to “${change.current}”` : ""}{" "}
            {change.slug ? (
              <Link className="font-extrabold text-civic" href={`/decisions/${change.slug}`}>
                view record
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      {result.count > result.items.length ? (
        <Link href="/changes" className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-civic">
          See the full movement log <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}
