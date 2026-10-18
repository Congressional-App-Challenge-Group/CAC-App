import type { DecisionStatus } from "@/types";
import { CIVIC_TIME_ZONE, todayIn } from "@/lib/deadlines";

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
export function statusFromAction(
  action: unknown,
  passed: unknown,
  date: string,
  now: Date = new Date(),
): DecisionStatus {
  const value = plain(action).toLowerCase();

  if (passed === 1 || passed === true) return "Approved";
  if (NEGATIVE.test(value)) return "Rejected";
  if (WITHDRAWAL.test(value)) return "Withdrawn";
  if (DEFERRAL.test(value)) return "Delayed";
  if (POSITIVE.test(value)) return "Approved";

  return isUpcoming(date, now) ? "Scheduled for vote" : "Under review";
}

/**
 * Whether a stated date is still ahead of the reader, counting today as ahead.
 *
 * This compares calendar days in the government's own time zone rather than
 * instants, because the instant comparison was wrong in the most important case
 * there is. A council meeting at 6:30pm on the 15th is a *future* event all day
 * on the 15th, but `new Date("2026-09-15") > new Date()` is false from midnight
 * onward — so every item on today's agenda was filed as "Under review" and
 * dropped off the deadline list on the one morning it mattered.
 *
 * It also has to be a local day, not a UTC one: at 9pm in Charlotte, UTC is
 * already tomorrow, which would close today's window early.
 */
function isUpcoming(date: string, now: Date = new Date()): boolean {
  const day = dateOnlyOrNull(date);
  return Boolean(day && day >= todayIn(CIVIC_TIME_ZONE, now));
}

/**
 * Approval labels the register publishes as a terminal status.
 *
 * Anchored at the start so a qualified label cannot pass as an approval, and
 * negated for the review states that merely contain the word — "Approved as to
 * Form" is a lawyer clearing a document, not a body deciding anything.
 */
const REGISTER_APPROVED = /^(approved|adopted|passed|enacted|ratified)\b/;
const NOT_AN_APPROVAL = /\b(as to form|for filing|for introduction|to be)\b/;

/**
 * Map the government's own matter register (`MatterStatusName`) to a stage.
 *
 * This is the highest-value resolution available: the register states outcomes
 * that the meeting-item feed leaves blank for most records.
 *
 * The status label is believed on its own. This previously also required a
 * populated pass date, which quietly discarded real outcomes: Charlotte
 * publishes "Approved" on `MatterTypeName: Zoning Decision` rows with a null
 * `MatterPassedDate`, so an approved rezoning was reported as still under review
 * — a positive misstatement, and the one kind of error this product cannot make.
 * The pass date is now informational rather than a precondition.
 *
 * `_passedDate` is kept in the signature because callers pass it positionally.
 */
export function statusFromMatter(
  statusName: unknown,
  _passedDate: unknown,
  agendaDate: unknown,
  now = new Date(),
): DecisionStatus | null {
  const value = plain(statusName).toLowerCase();
  if (!value) return null;

  if (NEGATIVE.test(value)) return "Rejected";
  if (WITHDRAWAL.test(value)) return "Withdrawn";
  if (DEFERRAL.test(value)) return "Delayed";
  if (REGISTER_APPROVED.test(value) && !NOT_AN_APPROVAL.test(value)) return "Approved";

  // "Agenda Ready" means the item is published on a future agenda — where
  // "future" includes today, so a matter being decided tonight stays on the
  // clock until the day is actually over in the government's own time zone.
  if (/agenda ready|on agenda|hearing|scheduled|pending/.test(value)) {
    const date = dateOnlyOrNull(agendaDate);
    if (!date) return "Under review";
    return isUpcoming(date, now) ? "Scheduled for vote" : "Under review";
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
 * Named recognitions, which are published exactly like decisions and decide nothing.
 *
 * "Resolution - Ms. Carrie Zimmerman Matthews 95th Birthday" contains the word
 * "resolution", so it scored 4 on relevance and cleared the threshold — a private
 * birthday framed as a legislative instrument and presented to a resident as a
 * tracked decision. The register itself types these "Ceremonial Item".
 *
 * The pattern is deliberately narrow. It fires only on a *named person* after a
 * recognising instrument, or on an explicit ordinal anniversary, so a real
 * instrument is never caught by it: "Resolution - Easement Maintenance" and
 * "Resolution authorising the purchase of..." both survive.
 */
/*
 * Written as a literal rather than a joined array of strings.
 *
 * The array form was tried first and was wrong in a way that looked right: the
 * three fragments were joined with `|`, so the separator fragment
 * (`instrument + dash`) became its own top-level alternative. That meant any
 * title of the shape "Resolution - " matched, and a genuine instrument —
 * "Resolution - Easement Maintenance Services contract" — was scored as a
 * recognition and dropped from the tracker. A literal cannot be mis-joined.
 */
const CEREMONIAL_HONORIFIC =
  /\b\d{1,3}(?:st|nd|rd|th)\s+(?:birthday|anniversary|year of service)\b|\b(?:resolution|proclamation|recognition|commendation|in memoriam)\s*[-\u2013\u2014:]\s*(?:mr|mrs|ms|dr|sir|rev|reverend|pastor|father|sister|chief|sheriff|judge|justice|councilman|councilwoman|commissioner|captain|sergeant|professor|senator)\.?\s+[A-Z]/i;

/** Titles that lead with a purely declaratory instrument. */
const CEREMONIAL_PROCLAMATION = /^proclamation\b/i;

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
  // Larger than any positive signal, so a recognition cannot be rescued by the
  // word "resolution" that qualifies it as one.
  if (CEREMONIAL_HONORIFIC.test(v)) n -= 8;
  // A proclamation declares a day or a month. It never decides anything, so the
  // subject it names must not be allowed to qualify it: "Proclamation - Fair
  // Housing Month" scored 3 on the word "housing" and reached residents as a
  // tracked decision.
  if (CEREMONIAL_PROCLAMATION.test(v)) n -= 8;
  if (MEETING_NOTICE.test(v)) n -= 12;
  return n;
}
