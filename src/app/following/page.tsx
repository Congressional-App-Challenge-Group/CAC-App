"use client";

import Link from "next/link";
import { ArrowRight, BellRing, Heart, MapPin } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { ChangesSinceVisit } from "@/features/following/changes-since-visit";
import { DecisionCard } from "@/features/decisions/decision-card";
import { usePreferences } from "@/features/preferences/preferences";
import { FollowPlaceButton } from "@/features/place/follow";
import {
  decisionPlaceCodes,
  parsePlaceKey,
  placeLabel,
  placeKindMeta,
  type PlaceKind,
} from "@/lib/place";
import { daysUntil, formatDeadlineDate, nextDeadline } from "@/lib/deadlines";
import { isOpenStatus } from "@/types";
import type { Decision } from "@/types";
import { PageHeader, SectionHeading } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Surface } from "@/components/ui/card";

/** A followed place, resolved against the records that actually sit in it. */
type FollowedPlace = {
  key: string;
  kind: PlaceKind;
  code: string;
  label: string;
  governs: string;
  body: string;
  decisions: Decision[];
  open: Decision[];
  next: { decision: Decision; date: string; days: number } | null;
};

function Metric({ n, label }: { n: number; label: string }) {
  return (
    <div className="card p-5">
      <p className="text-3xl font-black text-ink">{n}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

/**
 * The watchlist.
 *
 * Two kinds of subscription sit side by side because they answer the same
 * question two ways. Following an *item* is a decision someone already made to
 * care about it. Following a *place* is a standing question — "tell me when
 * anything happens on my block" — and it keeps working for records that did not
 * exist when it was set.
 *
 * Each followed place reports how many of its items are open, so a place with
 * nothing in it reads as quiet rather than as broken.
 */
export default function Following() {
  const decisions = useDecisions();
  const { following, followingPlaces, ready } = usePreferences();

  const saved = decisions.filter((decision) => following.includes(decision.id));

  const now = new Date();

  const places: FollowedPlace[] = followingPlaces
    .map((key) => {
      const parsed = parsePlaceKey(key);
      if (!parsed) return null;

      const inside = decisions.filter(
        (decision) => decisionPlaceCodes(decision.geography)[parsed.kind] === parsed.code,
      );
      const open = inside.filter((decision) => isOpenStatus(decision.status));

      let next: FollowedPlace["next"] = null;
      for (const decision of open) {
        const deadline = nextDeadline(decision, now);
        if (!deadline?.date) continue;
        const days = daysUntil(deadline.date, now);
        if (!Number.isFinite(days) || days < 0) continue;
        if (!next || days < next.days) next = { decision, date: deadline.date, days };
      }

      return {
        key,
        kind: parsed.kind,
        code: parsed.code,
        label: placeLabel(parsed.kind, parsed.code),
        governs: placeKindMeta[parsed.kind].governs,
        body: placeKindMeta[parsed.kind].body,
        decisions: inside,
        open,
        next,
      };
    })
    .filter((entry): entry is FollowedPlace => entry !== null);

  const recent = new Date(Date.now() - 30 * 86_400_000).toISOString();

  if (!saved.length && !places.length) {
    return (
      <div className="shell py-10">
        <PageHeader
          eyebrow="Your watchlist"
          title="Following"
          description="Status changes, recent updates, and upcoming dates for the items and places you follow."
        />
        <div className="card mt-8 p-12 text-center">
          <Heart className="mx-auto text-civic" />
          <h2 className="mt-3 text-xl font-black">Your watchlist is empty</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">
            Follow a decision to track one item, or follow a district to catch everything that lands
            in it — including matters that have not been published yet.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/explore" className="btn btn-primary">
              Explore decisions
            </Link>
            <Link href="/my-area" className="btn btn-secondary">
              Find my districts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-10">
      <PageHeader
        eyebrow="Your watchlist"
        title="Following"
        description="Status changes, recent updates, and upcoming dates for the items and places you follow."
      />

      {ready && (following.length > 0 || followingPlaces.length > 0) ? (
        <div className="my-6">
          <ChangesSinceVisit />
        </div>
      ) : null}

      <div className="my-8 grid gap-3 md:grid-cols-3">
        <Metric n={saved.length} label="Followed decisions" />
        <Metric n={places.length} label="Followed districts" />
        <Metric
          n={saved.filter((decision) => decision.timeline.some((event) => event.state === "upcoming")).length}
          label="Upcoming actions"
        />
      </div>

      {places.length ? (
        <section className="mb-14">
          <SectionHeading
            eyebrow="Standing watch"
            title="Districts you follow"
            description="Every indexed matter that lands in these districts, including ones published after you followed."
          />
          <div className="grid gap-5 md:grid-cols-2">
            {places.map((place) => (
              <Surface key={place.key} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-extrabold text-ink">
                      <MapPin size={16} className="shrink-0 text-civic" aria-hidden="true" />
                      {place.label}
                    </p>
                    <p className="mt-1 text-xs text-subtle">{place.body}</p>
                  </div>
                  <FollowPlaceButton
                    district={{ kind: place.kind, code: place.code, label: place.label }}
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-muted">
                  {place.decisions.length
                    ? `${place.decisions.length} indexed ${place.decisions.length === 1 ? "matter" : "matters"}, ${place.open.length} still open.`
                    : "No indexed matter with a confirmed location in this district yet."}
                </p>

                {place.next ? (
                  <p className="mt-3 rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-2 text-xs leading-5 text-ink-soft">
                    <b className="text-ink">
                      {place.next.days === 0 ? "Today" : `In ${place.next.days} days`}
                    </b>
                    {" — "}
                    {place.next.decision.title}
                    <span className="text-subtle"> · {formatDeadlineDate(place.next.date)}</span>
                  </p>
                ) : null}

                <Link
                  href={`/places/${place.kind}/${place.code}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-civic hover:text-civic-strong"
                >
                  <BellRing size={12} aria-hidden="true" />
                  Open {place.label}
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </Surface>
            ))}
          </div>
        </section>
      ) : null}

      {saved.length ? (
        <section>
          <SectionHeading
            eyebrow="Your list"
            title="Decisions you follow"
            description={`${saved.filter((decision) => decision.updatedAt >= recent).length} updated in the last 30 days.`}
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {saved.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                reason="You follow this decision"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
