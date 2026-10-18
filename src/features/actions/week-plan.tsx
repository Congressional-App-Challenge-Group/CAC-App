"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Info, ListChecks } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePlace } from "@/features/place/place";
import { actionsFor } from "@/lib/action";
import { daysUntil, formatDeadlineDate, nextDeadline } from "@/lib/deadlines";
import { placeMatch, type PlaceDistrict, type PlaceMatch } from "@/lib/place";
import { isOpenStatus } from "@/types";
import type { Decision } from "@/types";
import { cn } from "@/lib/cn";

type Item = {
  decision: Decision;
  match: PlaceMatch | null;
  date: string | null;
  days: number | null;
  /** 0 = dated this week and in your area · 3 = in your area, no published date. */
  tier: number;
};

/**
 * Rank what is worth a resident's attention this week.
 *
 * The rule is deliberately narrow: an item is either dated within the next seven
 * days, or it sits in the reader's own district. Anything else is not "this
 * week's business", and padding the list to three would be the same lie as a
 * page that always offers four calls to action. The list may be shorter than
 * three, and the heading says how many it found.
 */
function rankItems(
  decisions: Decision[],
  districts: PlaceDistrict[] | null,
  now: Date,
): Item[] {
  const items: Item[] = [];

  for (const decision of decisions) {
    if (!isOpenStatus(decision.status)) continue;

    const match = districts?.length ? placeMatch(decision, districts) : null;
    const deadline = nextDeadline(decision, now);
    const days = deadline?.date ? daysUntil(deadline.date, now) : null;
    const dated = days !== null && Number.isFinite(days) && days >= 0;
    const soon = dated && (days as number) <= 7;

    // Not dated soon and not in the reader's district: not this week's business.
    if (!soon && !match) continue;

    const tier = soon && match ? 0 : soon ? 1 : dated ? 2 : 3;
    items.push({
      decision,
      match,
      date: deadline?.date ?? null,
      days: dated ? (days as number) : null,
      tier,
    });
  }

  return items
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const left = a.days ?? Number.MAX_SAFE_INTEGER;
      const right = b.days ?? Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return (b.match?.weight ?? 0) - (a.match?.weight ?? 0);
    })
    .slice(0, 3);
}

export function WeekPlan() {
  const decisions = useDecisions();
  const { place, ready } = usePlace();

  // One clock for this render, so every countdown on the row agrees.
  const now = useMemo(() => new Date(), []);
  const districts = place?.districts ?? null;

  const items = useMemo(() => rankItems(decisions, districts, now), [decisions, districts, now]);

  if (!decisions.length) return null;

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <ListChecks size={16} className="text-civic" aria-hidden="true" />
          {items.length
            ? `Your ${items.length === 1 ? "one thing" : `${items.length} things`} this week`
            : "Your week"}
        </span>
        <span className="text-xs text-subtle">
          {ready && place
            ? `Dated soon, or in ${place.matchedAddress}`
            : "Dated within 7 days"}
        </span>
      </div>

      {items.length ? (
        <ul>
          {items.map((item) => {
            const action = actionsFor(item.decision, now)[0];
            return (
              <li key={item.decision.id} className="border-t border-line first:border-t-0">
                <Link
                  href={`/decisions/${item.decision.slug}`}
                  className="group flex items-start gap-4 px-4 py-4 transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "grid w-[76px] shrink-0 place-items-center rounded-xl border px-2 py-2 text-center",
                      item.tier === 0
                        ? "border-danger/35 bg-danger-bg text-danger"
                        : "border-line bg-surface-2 text-ink-soft",
                    )}
                  >
                    <span className="text-sm font-black leading-none tracking-[-0.03em]">
                      {item.days === null ? "—" : item.days === 0 ? "today" : item.days === 1 ? "1 day" : `${item.days}d`}
                    </span>
                    <span className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-subtle">
                      {item.date ? formatDeadlineDate(item.date) : "no date"}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    {item.match ? (
                      <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-civic">
                        {item.match.district.label}
                      </span>
                    ) : (
                      <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
                        Scheduled for decision
                      </span>
                    )}
                    <span className="mt-1.5 line-clamp-2 block font-extrabold leading-snug text-ink transition-colors group-hover:text-civic">
                      {item.decision.title}
                    </span>
                    {action ? (
                      <span className="mt-2 block text-xs leading-5 text-muted">
                        <b className="text-ink-soft">{action.title}.</b> {action.via ? `Via ${action.via}.` : ""}
                      </span>
                    ) : null}
                  </span>

                  <ArrowRight
                    size={17}
                    className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-civic"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-start gap-3 px-4 py-5 text-sm text-muted">
          <Info size={17} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
          <p>
            Nothing is dated for a decision in the next seven days, and no open item is in a district
            you have saved.{" "}
            {place ? null : (
              <Link href="/my-area" className="font-extrabold text-civic hover:text-civic-strong">
                Add your address
              </Link>
            )}{" "}
            This list fills in as the government publishes its agendas.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <span className="text-xs text-subtle">
          Every item states a date or a district in the government&apos;s own record.
        </span>
        <Link href="/my-area" className="text-xs font-extrabold text-civic hover:text-civic-strong">
          Open my area
        </Link>
      </div>
    </div>
  );
}
