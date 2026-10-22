import type { Decision, DecisionDeadline } from "@/types";
import { isDecidedStatus, isOpenStatus } from "@/types";

/**
 * Deadline engine.
 *
 * The tracker answers "what has the government decided". This answers the only
 * question a resident can still act on: "how long do I have". It is deliberately
 * narrow — a deadline is only ever a date the official record already states.
 * CivicLens does not derive comment windows, and an item with no stated date
 * reports no deadline rather than a confident guess.
 */

/** The three governments CivicLens tracks all publish on Eastern time. */
export const CIVIC_TIME_ZONE = "America/New_York";

const DAY_MS = 86_400_000;

/** Pull the YYYY-MM-DD portion of a Legistar timestamp or ISO string. */
export function dateOnly(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

function utcMidnight(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/**
 * Today's date as a reader in the civic time zone would write it.
 *
 * Using UTC would be wrong for anyone reading in the evening: at 9pm on the 13th
 * in Charlotte, UTC is already the 14th, and a countdown would skip a day.
 */
export function todayIn(timeZone: string = CIVIC_TIME_ZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole days from today to `date`. Negative means the date has passed. */
export function daysUntil(date: string, now: Date = new Date(), timeZone: string = CIVIC_TIME_ZONE): number {
  const target = dateOnly(date);
  if (!target) return Number.NaN;
  return Math.round((utcMidnight(target) - utcMidnight(todayIn(timeZone, now))) / DAY_MS);
}

export type DeadlineUrgency = "decided" | "past" | "today" | "tomorrow" | "this-week" | "soon" | "open" | "unknown";

export function urgencyForDays(days: number): DeadlineUrgency {
  if (!Number.isFinite(days)) return "unknown";
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "this-week";
  if (days <= 30) return "soon";
  return "open";
}

/** Plain countdown wording. Never rounds away the difference between today and tomorrow. */
export function countdown(days: number): string {
  if (!Number.isFinite(days)) return "No date on record";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export const urgencyLabel: Record<DeadlineUrgency, string> = {
  decided: "Decided",
  past: "Date passed",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This week",
  soon: "Coming up",
  open: "Scheduled",
  unknown: "No date on record",
};

/**
 * The next scheduled official action, or null.
 *
 * Precedence: an explicit deadline from the government's matter register, then a
 * future important date, then a timeline event the record marks as upcoming.
 * Dates already in the past are not reported as upcoming.
 */
export function nextDeadline(
  decision: Decision,
  now: Date = new Date(),
  timeZone: string = CIVIC_TIME_ZONE,
): DecisionDeadline | null {
  const explicit = decision.deadline;
  const explicitDate = dateOnly(explicit?.date);
  if (explicit && explicitDate && daysUntil(explicitDate, now, timeZone) >= 0) {
    return { ...explicit, date: explicitDate };
  }

  const dated = decision.importantDates
    .map((entry) => ({ date: dateOnly(entry.date), label: entry.label }))
    .filter((entry): entry is { date: string; label: string } => Boolean(entry.date))
    .filter((entry) => daysUntil(entry.date, now, timeZone) >= 0)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (dated.length) {
    return {
      date: dated[0].date,
      label: dated[0].label,
      origin: "record-text",
      sourceUrl: decision.sources[0]?.url,
    };
  }

  const upcoming = decision.timeline
    .filter((event) => event.state === "upcoming")
    .map((event) => ({ date: dateOnly(event.date), title: event.title }))
    .filter((event): event is { date: string; title: string } => Boolean(event.date))
    .filter((event) => daysUntil(event.date, now, timeZone) >= 0)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (upcoming.length) {
    return {
      date: upcoming[0].date,
      label: upcoming[0].title,
      origin: "record-text",
      sourceUrl: decision.sources[0]?.url,
    };
  }

  return null;
}

export type DeadlineStatus = {
  deadline: DecisionDeadline | null;
  days: number;
  urgency: DeadlineUrgency;
  countdown: string;
};

/** Everything a surface needs to render a countdown, in one call. */
export function deadlineStatus(
  decision: Decision,
  now: Date = new Date(),
  timeZone: string = CIVIC_TIME_ZONE,
): DeadlineStatus {
  if (isDecidedStatus(decision.status)) {
    return { deadline: null, days: Number.NaN, urgency: "decided", countdown: "Decided" };
  }

  const deadline = nextDeadline(decision, now, timeZone);
  if (!deadline) {
    return { deadline: null, days: Number.NaN, urgency: "unknown", countdown: "No date on record" };
  }

  const days = daysUntil(deadline.date!, now, timeZone);
  return { deadline, days, urgency: urgencyForDays(days), countdown: countdown(days) };
}

/**
 * True when a resident can still weigh in: the item is not decided, and the
 * record states an action date that has not passed.
 */
export function isActionable(
  decision: Decision,
  now: Date = new Date(),
  timeZone: string = CIVIC_TIME_ZONE,
): boolean {
  if (isDecidedStatus(decision.status)) return false;
  if (!isOpenStatus(decision.status)) return false;
  return nextDeadline(decision, now, timeZone) !== null;
}

export type UpcomingItem = {
  decision: Decision;
  deadline: DecisionDeadline;
  days: number;
  urgency: DeadlineUrgency;
  countdown: string;
};

/**
 * Upcoming scheduled actions, soonest first.
 *
 * Ties break on the more urgent stage (a vote outranks a review) so the list
 * leads with what is closest to being irreversible.
 */
export function upcomingActions(
  decisions: Decision[],
  options: { now?: Date; timeZone?: string; limit?: number; zipCode?: string } = {},
): UpcomingItem[] {
  const { now = new Date(), timeZone = CIVIC_TIME_ZONE, limit, zipCode } = options;

  const items = decisions
    .filter((decision) => (zipCode ? matchesZip(decision, zipCode) : true))
    .map((decision) => {
      const status = deadlineStatus(decision, now, timeZone);
      if (!status.deadline || !Number.isFinite(status.days)) return null;
      if (status.days < 0) return null;
      return {
        decision,
        deadline: status.deadline,
        days: status.days,
        urgency: status.urgency,
        countdown: status.countdown,
      } satisfies UpcomingItem;
    })
    .filter((item): item is UpcomingItem => item !== null)
    .sort((a, b) => a.days - b.days || stageWeight(b.decision.status) - stageWeight(a.decision.status));

  return limit ? items.slice(0, limit) : items;
}

function matchesZip(decision: Decision, zipCode: string): boolean {
  return decision.geography?.zipCode === zipCode || decision.affectedZipCodes.includes(zipCode);
}

function stageWeight(status: Decision["status"]): number {
  if (status === "Scheduled for vote") return 3;
  if (status === "Under review" || status === "Public feedback") return 2;
  return 1;
}

/** Long-form date for a deadline, e.g. "Monday, September 28, 2026". */
export function formatDeadlineDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
