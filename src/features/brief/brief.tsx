"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Clock, Info } from "lucide-react";
import { useDecisions } from "@/components/decisions-provider";
import { usePreferences } from "@/features/preferences/preferences";
import { DecisionCard } from "@/features/decisions/decision-card";
import { ChangeCard } from "@/features/changes/change-card";
import { WeekPlan } from "@/features/actions/week-plan";
import { Omission } from "@/features/brief/omission";
import { groupChangesByDecision } from "@/lib/changes";
import { formatDeadlineDate, upcomingActions } from "@/lib/deadlines";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { isDecidedStatus, isOpenStatus } from "@/types";
import type { Decision, DecisionChange, UserPreferences } from "@/types";
import { orgNames } from "@/lib/civic";
import { cn } from "@/lib/cn";

/** Explain why a record surfaced, so personalization is visible rather than magic. */
function reasonFor(decision: Decision, preferences: UserPreferences): string | undefined {
  const zip = decision.geography?.zipCode;
  if (zip && zip === preferences.zipCode) return `It is in your ZIP code (${zip}).`;
  if (decision.affectedZipCodes.includes(preferences.zipCode)) {
    return `It is in your ZIP code (${preferences.zipCode}).`;
  }
  const role = decision.affectedRoles.find((entry) => preferences.roles.includes(entry));
  if (role) return `It affects ${role.toLowerCase()}s.`;
  const interest = preferences.interests.find((entry) =>
    decision.topic.toLowerCase().includes(entry.toLowerCase()),
  );
  if (interest) return `It matches your interest in ${interest.toLowerCase()}.`;
  return undefined;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/**
 * One item on the deadline clock.
 *
 * Deliberately a row rather than a card: the timeline is the point, so the eye
 * should read the dates down a single column instead of scanning a grid.
 */
function ClockRow({
  decision,
  deadlineDate,
  countdown,
  days,
  urgency,
}: {
  decision: Decision;
  deadlineDate: string;
  countdown: string;
  days: number;
  urgency: string;
}) {
  const urgent = urgency === "today" || urgency === "tomorrow";

  return (
    <li>
      <Link
        href={`/decisions/${decision.slug}`}
        className={cn(
          "group flex items-start gap-4 border-t border-line px-4 py-4 transition-colors first:border-t-0 hover:bg-surface-2",
        )}
      >
        <div
          className={cn(
            "grid w-[92px] shrink-0 place-items-center rounded-xl border px-2 py-2 text-center",
            urgent
              ? "border-danger/35 bg-danger-bg text-danger"
              : "border-line bg-surface-2 text-ink-soft",
          )}
        >
          <span className="text-sm font-black leading-none tracking-[-0.03em]">{countdown}</span>
          <span className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-subtle">
            {days === 0 ? "today" : days === 1 ? "1 day" : `${days} days`}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
            {orgNames[decision.organization]}
            {decision.requester ? ` · ${decision.requester}` : ""}
          </p>
          <p className="mt-1.5 line-clamp-2 font-extrabold leading-snug text-ink transition-colors group-hover:text-civic">
            {decision.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-bold text-ink-soft">{deadlineDate}</span>
            {decision.geography?.zipCode ? (
              <span className="text-xs text-subtle">ZIP {decision.geography.zipCode}</span>
            ) : null}
          </div>
        </div>

        <ArrowRight
          size={17}
          className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-civic"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/**
 * The deadline instrument: what is about to be decided, and how long is left.
 *
 * This section exists because a tracker alone is retrospective. Everything here
 * has a date the official record states, so the countdown is a published fact and
 * not an estimate.
 */
function BeforeDecided({ decisions, now, zipCode }: { decisions: Decision[]; now: Date; zipCode: string }) {
  const soon = useMemo(() => upcomingActions(decisions, { now, limit: 40 }), [decisions, now]);
  const near = useMemo(
    () => soon.filter((item) => item.decision.geography?.zipCode === zipCode),
    [soon, zipCode],
  );

  const shown = (near.length ? near : soon).slice(0, 6);
  const thisWeek = soon.filter((item) => item.days <= 7).length;

  if (!shown.length) {
    return (
      <div className="surface flex items-start gap-3 p-5 text-sm text-muted">
        <Info size={17} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
        <p>
          No tracked item currently has a published date for its next action. This section fills in
          from the government&apos;s own agenda as soon as one is scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <Clock size={16} className="text-civic" aria-hidden="true" />
          {thisWeek > 0
            ? `${thisWeek} scheduled for decision within 7 days`
            : `${soon.length} scheduled for decision`}
        </span>
        <span className="text-xs text-subtle">
          {near.length ? `Filtered to ZIP ${zipCode}` : "Across all three governments"}
        </span>
      </div>
      <ul>
        {shown.map((item) => (
          <ClockRow
            key={item.decision.id}
            decision={item.decision}
            deadlineDate={formatDeadlineDate(item.deadline.date!)}
            countdown={item.countdown}
            days={item.days}
            urgency={item.urgency}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <span className="text-xs text-subtle">
          Dates come from the government&apos;s own matter register. CivicLens does not estimate them.
        </span>
        <Link href="/deadlines" className="text-xs font-extrabold text-civic hover:text-civic-strong">
          See all deadlines
        </Link>
      </div>
    </div>
  );
}

export function Brief({ changes }: { changes: DecisionChange[] }) {
  const decisions = useDecisions();
  const { preferences, ready } = usePreferences();

  const changeGroups = useMemo(() => groupChangesByDecision(changes).slice(0, 3), [changes]);

  const near = useMemo(() => {
    const scored = decisions
      .map((decision) => ({
        decision,
        inZip: decision.geography?.zipCode === preferences.zipCode,
        byInterest: preferences.interests.some((interest) =>
          decision.topic.toLowerCase().includes(interest.toLowerCase()),
        ),
      }))
      .filter((entry) => entry.inZip || entry.byInterest)
      .sort((a, b) => Number(b.inZip) - Number(a.inZip));
    return scored.slice(0, 3).map((entry) => entry.decision);
  }, [decisions, preferences]);

  const awaiting = useMemo(
    () =>
      decisions
        .filter((decision) => isOpenStatus(decision.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [decisions],
  );

  const closed = useMemo(
    () =>
      decisions
        .filter((decision) => isDecidedStatus(decision.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3),
    [decisions],
  );

  // One clock for the whole brief, so every countdown on the page agrees.
  const now = useMemo(() => new Date(), []);

  const newest = useMemo(
    () => [...decisions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3),
    [decisions],
  );

  if (!decisions.length) {
    return (
      <EmptyState
        title="No verified records are published yet"
        body="CivicLens only shows records it can trace to an official source. Once the ingestion job publishes decisions, they will appear here."
      />
    );
  }

  return (
    <div className="space-y-16">
      <Reveal>
        <section aria-labelledby="week-heading">
          <SectionHeading
            eyebrow="Your week"
            title="What to act on now"
            description="At most three items: dated for a decision in the next seven days, or sitting in the district you live in. A shorter list is a real answer."
            actionHref="/my-area"
            actionLabel="My area"
          />
          <WeekPlan />
        </section>
      </Reveal>

      <Reveal>
        <Omission />
      </Reveal>

      <Reveal>
        <section aria-labelledby="deadlines-heading">
          <SectionHeading
            eyebrow="On the clock"
            title="Before it's decided"
            description="Items with a published date for their next action, soonest first. Once a vote happens, this is the moment that has passed."
            actionHref="/deadlines"
            actionLabel="All deadlines"
          />
          <BeforeDecided decisions={decisions} now={now} zipCode={preferences.zipCode} />
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="changed-heading">
          <SectionHeading
            eyebrow="Movement"
            title="Changed this week"
            description="Detected by comparing each ingestion run against the previous one."
            actionHref="/changes"
            actionLabel="See all changes"
          />
          {changeGroups.length ? (
            <Grid>
              {changeGroups.map((group) => (
                <ChangeCard
                  key={group.decisionId}
                  slug={group.slug}
                  title={group.title}
                  organization={group.organization}
                  changes={group.changes}
                />
              ))}
            </Grid>
          ) : (
            <div className="surface flex items-start gap-3 p-5 text-sm text-muted">
              <Info size={17} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
              <p>
                No movements have been recorded yet. The change engine reports on its second run — a
                first appearance is a publication, not a change.
              </p>
            </div>
          )}
        </section>
      </Reveal>

      {near.length ? (
        <Reveal>
          <section aria-labelledby="near-heading">
            <SectionHeading
              eyebrow="Where you live"
              title={ready ? `Near ${preferences.zipCode}` : "Near you"}
              description="Records whose location or topic matches your saved preferences."
              actionHref="/my-area"
              actionLabel="Open my area"
            />
            <Grid>
              {near.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} reason={reasonFor(decision, preferences)} />
              ))}
            </Grid>
          </section>
        </Reveal>
      ) : null}

      <Reveal>
        <section aria-labelledby="awaiting-heading">
          <SectionHeading
            eyebrow="Open items"
            title="Awaiting a decision"
            description="Still open for public input, under review, or heading to a vote."
            actionHref="/explore"
            actionLabel="View all open items"
          />
          <Grid>
            {awaiting.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </Grid>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="new-heading">
          <SectionHeading
            eyebrow="New to the tracker"
            title="Just added"
            description="Records that entered the tracker most recently."
          />
          <Grid>
            {newest.map((decision) => (
              <DecisionCard key={decision.id} decision={decision} />
            ))}
          </Grid>
        </section>
      </Reveal>

      {closed.length ? (
        <Reveal>
          <section aria-labelledby="closed-heading">
            <SectionHeading
              eyebrow="Closed out"
              title="Recently decided"
              description="Items the official record now shows as decided, funded, or complete."
              actionHref="/explore"
              actionLabel="View all decided"
            />
            <Grid>
              {closed.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))}
            </Grid>
          </section>
        </Reveal>
      ) : null}

      <Reveal>
        <div className="surface flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3">
            <Activity size={18} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
            <div>
              <p className="font-extrabold text-ink">Follow what matters and we&apos;ll track it</p>
              <p className="mt-1 text-sm text-muted">
                Follow any record to build your list. Notifications arrive once the movement engine
                has new changes to report.
              </p>
            </div>
          </div>
          <Link href="/following" className="btn btn-secondary">
            Open following
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
