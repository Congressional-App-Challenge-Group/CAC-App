import type { DecisionStatus } from "@/types";

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export function plain(value: unknown) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Outcome resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Negations are checked before affirmations.
 *
 * The previous order tested `/adopted|approved|passed/` first, so a recorded
 * action of "Not Passed" matched "passed" and was filed as Approved — an
 * inversion of the actual outcome. Rejection is now read first.
 */
const NEGATIVE = /\b(denied|rejected|failed|not passed|not approved|did not pass|defeated)\b/;
const DEFERRAL = /\b(defer|deferred|deferral|continue|continued|continuance|postponed|postpone|tabled|hold over|held over|carried over)\b/;
const WITHDRAWAL = /\b(withdrawn|withdrew|withdraw)\b/;
const POSITIVE = /\b(adopted|approved|passed|enacted|ratified)\b/;

/**
 * Map a recorded Legistar action to a tracked stage.
 *
 * Deferrals previously fell through to "Under review", which is part of why so
 * many records sat frozen: a matter the body postponed looked identical to one
 * nobody had touched yet.
 */
export function statusFromAction(action: unknown, passed: unknown, date: string): DecisionStatus {
  const value = plain(action).toLowerCase();

  if (passed === 1 || passed === true) return "Approved";
  if (NEGATIVE.test(value)) return "Rejected";
  if (WITHDRAWAL.test(value)) return "Withdrawn";
  if (DEFERRAL.test(value)) return "Delayed";
  if (POSITIVE.test(value)) return "Approved";

  return new Date(date) > new Date() ? "Scheduled for vote" : "Under review";
}

/**
 * Map the government's own matter register (`MatterStatusName`) to a stage.
 *
 * This is the highest-value resolution available: the register states outcomes
 * that the meeting-item feed leaves blank for most records.
 */
export function statusFromMatter(
  statusName: unknown,
  passedDate: unknown,
  agendaDate: unknown,
  now = new Date(),
): DecisionStatus | null {
  const value = plain(statusName).toLowerCase();
  if (!value) return null;

  if (NEGATIVE.test(value)) return "Rejected";
  if (WITHDRAWAL.test(value)) return "Withdrawn";
  if (DEFERRAL.test(value)) return "Delayed";
  if (POSITIVE.test(value) && plain(passedDate)) return "Approved";

  // "Agenda Ready" means the item is published on a future agenda.
  if (/agenda ready|on agenda|hearing|scheduled|pending/.test(value)) {
    const date = dateOnlyOrNull(agendaDate);
    if (!date) return "Under review";
    return new Date(`${date}T12:00:00Z`) > now ? "Scheduled for vote" : "Under review";
  }

  // "Filed" closes a matter without further action. These are overwhelmingly
  // procedural items (Mayor and Council Topics, City Manager's Report).
  if (/^filed$|closed|complete/.test(value)) return "Completed";

  return null;
}

/** Extract a YYYY-MM-DD date from a Legistar timestamp, ignoring time and zone. */
export function dateOnlyOrNull(value: unknown): string | null {
  const match = plain(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function topicFromText(value: string) {
  const v = value.toLowerCase();
  if (/rezon|zoning|development|housing/.test(v)) return "Development and rezoning";
  if (/school|student|education/.test(v)) return "Education";
  if (/transit|bus|rail/.test(v)) return "Public transit";
  if (/budget|appropriat|fund|contract/.test(v)) return "Government budgets";
  if (/road|street|traffic|transport/.test(v)) return "Roads";
  if (/park|greenway/.test(v)) return "Parks";
  if (/health/.test(v)) return "Public health";
  if (/police|fire|safety/.test(v)) return "Public safety";
  return "Local government";
}

/**
 * Meeting notices, not decisions.
 *
 * Legistar publishes some agenda entries that are administrative notices rather
 * than items anyone decides: the recurring "Upcoming meetings of the Board"
 * block, its accessibility paragraph, and procedural openers. They carry the
 * words that normally signal substance ("budget", "public") so they clear the
 * relevance threshold, and some run to over 1,400 characters.
 */
const MEETING_NOTICE =
  /upcoming meetings of the board|special accommodations|closed session|invocation|pledge of allegiance|adjournment|mayor and council topics|city manager.{0,3}s report|community of pride and choice|to serve mecklenburg county residents by helping/;

const CEREMONIAL = /ceremon|recognition|minutes|invocation|pledge|adjourn/;

/**
 * Relevance score. Items scoring below 2 are not tracked at all.
 *
 * The meeting-notice penalty is larger than the positive signals combined, so a
 * notice cannot be rescued by its own boilerplate containing the word "budget".
 */
export function importance(value: string) {
  const v = value.toLowerCase();
  let n = 0;
  if (/ordinance|resolution|policy|adopt|approve|vote/.test(v)) n += 4;
  if (/budget|million|funding|contract/.test(v)) n += 3;
  if (/public hearing|rezon|housing|school|transit|tax|safety/.test(v)) n += 3;
  if (CEREMONIAL.test(v)) n -= 5;
  if (MEETING_NOTICE.test(v)) n -= 12;
  return n;
}
