import { CalendarClock, Clock, Info } from "lucide-react";
import type { Decision } from "@/types";
import { cn } from "@/lib/cn";
import { deadlineStatus, formatDeadlineDate, type DeadlineUrgency } from "@/lib/deadlines";
import { isDecidedStatus } from "@/types";

/**
 * Countdown primitives.
 *
 * The tracker reports what was decided. These report what is still open, which
 * is the only window in which a resident can change anything. Tones escalate as
 * the date approaches so urgency is visible without reading the number.
 */

const urgencyTone: Record<DeadlineUrgency, string> = {
  today: "border-danger/40 bg-danger-bg text-danger",
  tomorrow: "border-danger/35 bg-danger-bg text-danger",
  "this-week": "border-warning/35 bg-warning-bg text-warning",
  soon: "border-civic/35 bg-civic/8 text-civic-strong",
  open: "border-line bg-surface-2 text-ink-soft",
  past: "border-line bg-surface-2 text-subtle",
  decided: "border-line bg-surface-2 text-subtle",
  unknown: "border-line bg-surface-2 text-subtle",
};

/** A countdown pill. Renders nothing when the record states no date. */
export function CountdownBadge({
  decision,
  now,
  className,
}: {
  decision: Decision;
  now?: Date;
  className?: string;
}) {
  const status = deadlineStatus(decision, now);
  if (!status.deadline || isDecidedStatus(decision.status)) return null;

  const urgent = status.urgency === "today" || status.urgency === "tomorrow";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.06em]",
        urgencyTone[status.urgency],
        className,
      )}
      title={`Next scheduled action: ${formatDeadlineDate(status.deadline.date!)}`}
    >
      {urgent ? <Clock size={12} aria-hidden="true" /> : <CalendarClock size={12} aria-hidden="true" />}
      {status.countdown}
    </span>
  );
}

/**
 * The full deadline panel for a decision page.
 *
 * States plainly what the date is, who published it, and that the comment window
 * itself is set by the meeting body — CivicLens shows the date the record
 * states and does not invent a cut-off.
 */
export function DeadlinePanel({ decision, now }: { decision: Decision; now?: Date }) {
  const { deadline, days, urgency, countdown } = deadlineStatus(decision, now);

  if (isDecidedStatus(decision.status)) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface-2 p-5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <CalendarClock size={17} className="text-subtle" aria-hidden="true" />
          This item has been decided
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          Its stage is now {decision.status.toLowerCase()}, so the window to weigh in has closed.
          You can still read what the record says it did.
        </p>
      </div>
    );
  }

  if (!deadline) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-warning/30 bg-warning-bg p-5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-warning">
          <Info size={16} aria-hidden="true" />
          No action date on the record
        </div>
        <p className="mt-2 text-sm leading-6 text-ink font-medium">
          This item is still open, but the official record states no date for its next action — so
          there is nothing to count down to. CivicLens does not estimate one.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-[var(--radius-lg)] border p-5", urgencyTone[urgency])}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">
          Next scheduled action
        </span>
        <span className="text-2xl font-black tracking-[-0.04em]">{countdown}</span>
      </div>

      <p className="mt-3 text-base font-extrabold text-ink">{formatDeadlineDate(deadline.date!)}</p>
      {deadline.label ? <p className="mt-1 text-sm text-ink-soft">{deadline.label}</p> : null}

      <p className="mt-4 border-t border-current/15 pt-4 text-xs leading-5 text-ink-soft">
        {deadline.origin === "official-tracker"
          ? `Published by the government's own matter register${deadline.officialStatus ? `, which lists this item as “${deadline.officialStatus}”` : ""}.`
          : "Taken from a date stated in the official record."}{" "}
        {days >= 0
          ? "The record does not state a comment cut-off; the meeting body sets that on the published agenda."
          : null}
      </p>

      {deadline.sourceUrl ? (
        <a
          href={deadline.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold underline decoration-current/30 underline-offset-4"
        >
          Official meeting calendar
        </a>
      ) : null}
    </div>
  );
}
