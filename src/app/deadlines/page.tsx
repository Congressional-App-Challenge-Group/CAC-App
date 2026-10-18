import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Info } from "lucide-react";
import { getDecisions } from "@/server/decisions";
import { orgNames } from "@/lib/civic";
import {
  formatDeadlineDate,
  upcomingActions,
  urgencyLabel,
  type DeadlineUrgency,
  type UpcomingItem,
} from "@/lib/deadlines";
import { PageHeader } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { agendaKind, agendaKindNote } from "@/lib/agenda";
import { isOpenStatus } from "@/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Deadlines",
  description:
    "Every tracked item with a date the official record states, ordered by how long is left — and which of them the agenda actually schedules a decision on.",
};

/** Display order: the soonest and most consequential first. */
const BANDS: Array<{ key: DeadlineUrgency; title: string; blurb: string }> = [
  {
    key: "today",
    title: "Being decided today",
    // Not "the last day to be heard": a section can schedule a vote with no
    // public comment at all, and each body sets its own rules.
    blurb: "The record states today's meeting. How this body takes public comment is set by its own rules — the linked agenda says which section the item sits in.",
  },
  {
    key: "tomorrow",
    title: "Being decided tomorrow",
    blurb: "On tomorrow's published agenda.",
  },
  {
    key: "this-week",
    title: "Within seven days",
    blurb: "Scheduled inside the week ahead.",
  },
  {
    key: "soon",
    title: "Within thirty days",
    blurb: "On the horizon, with a stated date.",
  },
  {
    key: "open",
    title: "Later",
    blurb: "Scheduled more than a month out.",
  },
];

function bandTone(key: DeadlineUrgency): string {
  if (key === "today" || key === "tomorrow") return "border-danger/30 bg-danger-bg text-danger";
  if (key === "this-week") return "border-warning/30 bg-warning-bg text-warning";
  return "border-line bg-surface-2 text-ink-soft";
}

function Row({ item }: { item: UpcomingItem }) {
  const { decision, deadline, days, countdown: label } = item;
  const urgent = days <= 1;
  const kind = agendaKind(deadline.officialStatus);
  const note = agendaKindNote(deadline.officialStatus);

  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/decisions/${decision.slug}`}
        className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-start sm:gap-5"
      >
        <div className="flex shrink-0 items-center gap-2 sm:w-36 sm:flex-col sm:items-start">
          <span
            className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-black ${
              urgent ? "border-danger/35 bg-danger-bg text-danger" : "border-line bg-surface-2 text-ink-soft"
            }`}
          >
            {label}
          </span>
          <span className="text-[11px] font-bold text-subtle">{days}d</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-subtle">
              {orgNames[decision.organization]}
            </span>
            {/*
              A briefing or a report is not "Scheduled for vote", whatever the
              stage field says, so the stage badge is withheld there rather than
              repeating a claim the agenda contradicts.
            */}
            {kind === "informational" ? (
              <Badge tone="neutral">No vote scheduled</Badge>
            ) : (
              <StatusBadge status={decision.status} />
            )}
          </div>
          <p className="mt-2 font-extrabold leading-snug text-ink transition-colors group-hover:text-civic">
            {decision.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
            <span className="flex items-center gap-1.5 font-bold text-ink-soft">
              <CalendarClock size={12} aria-hidden="true" />
              {formatDeadlineDate(deadline.date!)}
            </span>
            {deadline.officialStatus ? (
              <span className="font-bold text-ink-soft">“{deadline.officialStatus}”</span>
            ) : deadline.label ? (
              <span>{deadline.label}</span>
            ) : null}
            {decision.geography?.zipCode ? <span>ZIP {decision.geography.zipCode}</span> : null}
            {decision.requester ? <span>Requested by {decision.requester}</span> : null}
          </div>
          {note ? <p className="mt-1.5 text-xs leading-5 text-subtle">{note}</p> : null}
        </div>
      </Link>
    </li>
  );
}

export default async function DeadlinesPage() {
  const decisions = await getDecisions();
  const now = new Date();
  const items = upcomingActions(decisions, { now });

  /*
   * Items whose agenda section schedules no vote are separated out.
   *
   * They keep their real date — the meeting is genuinely happening — but they
   * are not "about to be decided", so they cannot sit under a band that says so.
   * Of the six Mecklenburg items on 20 October, three were a staff briefing, a
   * manager's report and a commissioner reports section; all three were listed as
   * "Scheduled for vote" until the agenda sections were read.
   */
  const scheduled = items.filter((item) => agendaKind(item.deadline.officialStatus) !== "informational");
  const briefed = items.filter((item) => agendaKind(item.deadline.officialStatus) === "informational");

  const open = decisions.filter((decision) => isOpenStatus(decision.status));
  const undated = open.filter((decision) => !items.some((item) => item.decision.id === decision.id));

  return (
    <div className="shell py-10 md:py-14">
      <PageHeader
        eyebrow="On the clock"
        title="What's about to be decided"
        description="A tracker tells you what happened. This tells you what still can be changed — every item below has a date the official record itself states, and none of them is guessed."
      />

      {scheduled.length ? (
        <div className="mt-10 space-y-10">
          {BANDS.map((band) => {
            const bandItems = scheduled.filter((item) => item.urgency === band.key);
            if (!bandItems.length) return null;

            return (
              <section key={band.key} aria-labelledby={`band-${band.key}`}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <h2 id={`band-${band.key}`} className="display-3 text-ink">
                    {band.title}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] ${bandTone(band.key)}`}
                  >
                    {urgencyLabel[band.key]} · {bandItems.length}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-muted">{band.blurb}</p>
                <ul className="card mt-4 overflow-hidden p-0">
                  {bandItems.map((item) => (
                    <Row key={item.decision.id} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="Nothing currently has a published date for a decision"
            body="When a government publishes a date for its next action on a tracked item, it appears here with a countdown. Until then, there is nothing to count down to — and CivicLens does not estimate one."
          />
        </div>
      )}

      {briefed.length ? (
        <section className="mt-12" aria-labelledby="band-briefed">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 id="band-briefed" className="display-3 text-ink">
              Also on the agenda
            </h2>
            <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.06em] text-ink-soft">
              No vote scheduled · {briefed.length}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            These items have a published date — the meeting is happening — but the agenda
            schedules no vote on them: a briefing, a report or a short presentation. They are
            listed so the date is not mistaken for a decision pending, and so the record is not
            emptier than it is.
          </p>
          <ul className="card mt-4 overflow-hidden p-0">
            {briefed.map((item) => (
              <Row key={item.decision.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 border-t border-line pt-8">
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-line bg-surface-2 p-5">
          <Info size={18} className="mt-0.5 shrink-0 text-civic" aria-hidden="true" />
          <div className="text-sm leading-6 text-muted">
            <p className="font-extrabold text-ink">
              {undated.length} open items state no date at all
            </p>
            <p className="mt-1.5">
              Those items are still open, but the official record never publishes when their next
              action happens, so they cannot appear above. That omission is counted publicly rather
              than filled in with an estimate.
            </p>
            <p className="mt-2">
              Every countdown above comes from a date the government itself published. Comment
              cut-offs are set by each meeting body, so confirm them on the linked agenda before
              relying on them.
            </p>
            <Link
              href="/evidence"
              className="mt-2 inline-block text-xs font-extrabold text-civic hover:text-civic-strong"
            >
              See the disclosure gap
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
