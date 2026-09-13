import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CIVIC_TIME_ZONE,
  countdown,
  dateOnly,
  daysUntil,
  deadlineStatus,
  formatDeadlineDate,
  isActionable,
  nextDeadline,
  todayIn,
  upcomingActions,
  urgencyForDays,
} from "./deadlines";
import type { Decision } from "@/types";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:29968",
    slug: "charlotte-29968-rezoning-petition",
    title: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
    organization: "charlotte",
    topic: "Development and rezoning",
    status: "Scheduled for vote",
    summary: "Rezoning Petition: 2025-011",
    whyItMatters: "Rezoning decides what may be built on one site.",
    latestUpdate: "Scheduled for the council agenda.",
    nextStep: null,
    publishedAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    affectedRoles: [],
    affectedZipCodes: [],
    affectedAreas: [],
    importantDates: [],
    isPublished: true,
    timeline: [],
    sources: [],
    ...overrides,
  };
}

// A fixed weekday, so the suite never depends on when it runs.
const NOW = new Date("2026-09-11T16:00:00Z"); // 12:00 in Charlotte

/* -------------------------------------------------------------------------- */
/* Dates and time zones                                                        */
/* -------------------------------------------------------------------------- */

test("dateOnly reads the date out of a Legistar timestamp", () => {
  assert.equal(dateOnly("2026-09-14T00:00:00"), "2026-09-14");
  assert.equal(dateOnly("2026-09-14"), "2026-09-14");
  assert.equal(dateOnly("not a date"), null);
  assert.equal(dateOnly(null), null);
});

test("todayIn resolves the civic time zone, not UTC", () => {
  // 01:30 UTC on the 14th is still 9:30pm on the 13th in Charlotte. Counting in
  // UTC here would report a deadline one day early for anyone reading at night.
  const lateEvening = new Date("2026-09-14T01:30:00Z");
  assert.equal(todayIn(CIVIC_TIME_ZONE, lateEvening), "2026-09-13");
  assert.equal(todayIn("UTC", lateEvening), "2026-09-14");
});

test("daysUntil counts calendar days in the civic time zone", () => {
  const lateEvening = new Date("2026-09-14T01:30:00Z");
  assert.equal(daysUntil("2026-09-14", lateEvening), 1);
  assert.equal(daysUntil("2026-09-13", lateEvening), 0);
  assert.equal(daysUntil("2026-09-10", lateEvening), -3);
});

test("daysUntil is a whole number of days across a month boundary", () => {
  assert.equal(daysUntil("2026-10-01", new Date("2026-09-28T16:00:00Z")), 3);
  assert.equal(daysUntil("2026-10-26", new Date("2026-09-13T16:00:00Z")), 43);
});

/* -------------------------------------------------------------------------- */
/* Urgency and countdown wording                                               */
/* -------------------------------------------------------------------------- */

test("urgencyForDays separates today, tomorrow and this week", () => {
  assert.equal(urgencyForDays(0), "today");
  assert.equal(urgencyForDays(1), "tomorrow");
  assert.equal(urgencyForDays(6), "this-week");
  assert.equal(urgencyForDays(8), "soon");
  assert.equal(urgencyForDays(30), "soon");
  assert.equal(urgencyForDays(45), "open");
  assert.equal(urgencyForDays(-1), "past");
  assert.equal(urgencyForDays(Number.NaN), "unknown");
});

test("countdown never rounds away a day", () => {
  assert.equal(countdown(0), "Today");
  assert.equal(countdown(1), "Tomorrow");
  assert.equal(countdown(2), "in 2 days");
  assert.equal(countdown(-1), "Yesterday");
  assert.equal(countdown(-5), "5 days ago");
  assert.equal(countdown(Number.NaN), "No date on record");
});

/* -------------------------------------------------------------------------- */
/* Finding the next action                                                     */
/* -------------------------------------------------------------------------- */

test("nextDeadline prefers the official tracker's date", () => {
  const deadline = nextDeadline(
    decision({
      deadline: { date: "2026-09-28", label: "Council agenda", origin: "official-tracker" },
      importantDates: [{ date: "2026-09-20", label: "Some earlier date" }],
    }),
    NOW,
  );
  assert.equal(deadline?.date, "2026-09-28");
  assert.equal(deadline?.origin, "official-tracker");
});

test("nextDeadline falls back to the earliest future important date", () => {
  const deadline = nextDeadline(
    decision({
      importantDates: [
        { date: "2026-10-01", label: "Second reading" },
        { date: "2026-09-20", label: "Public hearing" },
        { date: "2026-09-01", label: "Introduced" },
      ],
    }),
    NOW,
  );
  assert.equal(deadline?.date, "2026-09-20");
  assert.equal(deadline?.origin, "record-text");
});

test("nextDeadline ignores dates that have already passed", () => {
  const deadline = nextDeadline(
    decision({
      deadline: { date: "2026-08-01", label: "Old agenda date", origin: "official-tracker" },
      importantDates: [{ date: "2026-09-01", label: "Introduced" }],
    }),
    NOW,
  );
  assert.equal(deadline, null);
});

test("no stated date produces no deadline rather than a guess", () => {
  const status = deadlineStatus(decision(), NOW);
  assert.equal(status.deadline, null);
  assert.equal(status.urgency, "unknown");
  assert.equal(status.countdown, "No date on record");
});

test("a decided record reports decided even if it still carries a date", () => {
  const status = deadlineStatus(
    decision({
      status: "Approved",
      deadline: { date: "2026-09-28", label: "Council agenda", origin: "official-tracker" },
    }),
    NOW,
  );
  assert.equal(status.urgency, "decided");
  assert.equal(status.countdown, "Decided");
});

test("isActionable is true only for open items with a future stated date", () => {
  assert.equal(
    isActionable(decision({ deadline: { date: "2026-09-28", origin: "official-tracker" } }), NOW),
    true,
  );
  assert.equal(isActionable(decision(), NOW), false);
  assert.equal(
    isActionable(
      decision({
        status: "Approved",
        deadline: { date: "2026-09-28", origin: "official-tracker" },
      }),
      NOW,
    ),
    false,
  );
});

/* -------------------------------------------------------------------------- */
/* Ordering                                                                    */
/* -------------------------------------------------------------------------- */

test("upcomingActions orders soonest first and drops undated records", () => {
  const items = upcomingActions(
    [
      decision({ id: "a", deadline: { date: "2026-10-12", origin: "official-tracker" } }),
      decision({ id: "b" }),
      decision({ id: "c", deadline: { date: "2026-09-14", origin: "official-tracker" } }),
    ],
    { now: NOW },
  );
  assert.deepEqual(
    items.map((item) => item.decision.id),
    ["c", "a"],
  );
  assert.equal(items[0].days, 3);
  assert.equal(items[0].countdown, "in 3 days");
});

test("upcomingActions breaks same-day ties toward the later stage", () => {
  const items = upcomingActions(
    [
      decision({
        id: "review",
        status: "Under review",
        deadline: { date: "2026-09-14", origin: "official-tracker" },
      }),
      decision({
        id: "vote",
        status: "Scheduled for vote",
        deadline: { date: "2026-09-14", origin: "official-tracker" },
      }),
    ],
    { now: NOW },
  );
  assert.equal(items[0].decision.id, "vote");
});

test("upcomingActions can narrow to one ZIP code", () => {
  const items = upcomingActions(
    [
      decision({
        id: "in-area",
        geography: { zipCode: "28205", method: "petition-match", confidence: "exact" },
        deadline: { date: "2026-09-14", origin: "official-tracker" },
      }),
      decision({
        id: "elsewhere",
        geography: { zipCode: "28278", method: "petition-match", confidence: "exact" },
        deadline: { date: "2026-09-14", origin: "official-tracker" },
      }),
    ],
    { now: NOW, zipCode: "28205" },
  );
  assert.deepEqual(
    items.map((item) => item.decision.id),
    ["in-area"],
  );
});

test("formatDeadlineDate renders a long date without shifting the day", () => {
  assert.equal(formatDeadlineDate("2026-09-28"), "Monday, September 28, 2026");
  assert.equal(formatDeadlineDate("garbage"), "garbage");
});
