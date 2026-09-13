import assert from "node:assert/strict";
import { test } from "node:test";
import { dateOnlyOrNull, importance, statusFromAction, statusFromMatter } from "./normalize";

const NOW = new Date("2026-09-13T16:00:00Z");

/* -------------------------------------------------------------------------- */
/* Recorded actions                                                            */
/* -------------------------------------------------------------------------- */

test("a passed flag resolves to Approved", () => {
  assert.equal(statusFromAction("", 1, "2026-09-01"), "Approved");
});

test("explicit approvals resolve to Approved", () => {
  assert.equal(statusFromAction("Approved", 0, "2026-09-01"), "Approved");
  assert.equal(statusFromAction("Adopted as amended", 0, "2026-09-01"), "Approved");
});

test("a recorded action of Not Passed is a rejection, not an approval", () => {
  // Regression: the old order tested /passed/ before the negations, so a "Not
  // Passed" action was filed as Approved — an inversion of the real outcome.
  assert.equal(statusFromAction("Not Passed", 0, "2026-09-01"), "Rejected");
  assert.equal(statusFromAction("Not Approved", 0, "2026-09-01"), "Rejected");
  assert.equal(statusFromAction("Denied", 0, "2026-09-01"), "Rejected");
});

test("deferrals resolve to Delayed instead of falling through to Under review", () => {
  // Regression: "Defer" previously matched nothing and became "Under review",
  // which is why postponed matters sat frozen alongside untouched ones.
  assert.equal(statusFromAction("Defer", 0, "2026-09-01"), "Delayed");
  assert.equal(statusFromAction("Deferred", 0, "2026-09-01"), "Delayed");
  assert.equal(statusFromAction("Continued to October 12", 0, "2026-09-01"), "Delayed");
  assert.equal(statusFromAction("Postponed", 0, "2026-09-01"), "Delayed");
  assert.equal(statusFromAction("Tabled", 0, "2026-09-01"), "Delayed");
  assert.equal(statusFromAction("Held Over", 0, "2026-09-01"), "Delayed");
});

test("withdrawals resolve to Withdrawn", () => {
  assert.equal(statusFromAction("Withdrawn", 0, "2026-09-01"), "Withdrawn");
});

test("an actionless future item is Scheduled for vote and a past one is Under review", () => {
  assert.equal(statusFromAction("", 0, "2026-09-28"), "Scheduled for vote");
  assert.equal(statusFromAction("", 0, "2026-08-01"), "Under review");
});

/* -------------------------------------------------------------------------- */
/* The government's own matter register                                        */
/* -------------------------------------------------------------------------- */

test("Agenda Ready with a future agenda date is Scheduled for vote", () => {
  assert.equal(statusFromMatter("Agenda Ready", null, "2026-09-28T00:00:00", NOW), "Scheduled for vote");
});

test("Agenda Ready with a stale agenda date falls back to Under review", () => {
  assert.equal(statusFromMatter("Agenda Ready", null, "2026-08-03T00:00:00", NOW), "Under review");
});

test("a register approval needs a passed date to resolve", () => {
  assert.equal(statusFromMatter("Approved", "2026-08-24T00:00:00", "2026-08-24T00:00:00", NOW), "Approved");
  assert.equal(statusFromMatter("Approved", null, null, NOW), null);
});

test("Filed closes a procedural matter rather than leaving it open", () => {
  assert.equal(statusFromMatter("Filed", "2026-08-24T00:00:00", "2026-08-24T00:00:00", NOW), "Completed");
});

test("register statuses map withdrawals and deferrals too", () => {
  assert.equal(statusFromMatter("Withdrawn", null, null, NOW), "Withdrawn");
  assert.equal(statusFromMatter("Postponed", null, null, NOW), "Delayed");
});

test("an unrecognised or empty register status resolves to nothing", () => {
  assert.equal(statusFromMatter("", null, null, NOW), null);
  assert.equal(statusFromMatter("Under Review by Council", null, null, NOW), null);
});

/* -------------------------------------------------------------------------- */
/* Relevance                                                                   */
/* -------------------------------------------------------------------------- */

// Items scoring below 2 are dropped by the ingester.
const TRACKED_THRESHOLD = 2;

test("substantive items clear the tracking threshold", () => {
  assert.ok(importance("Ordinance to adopt the FY2027 budget") >= TRACKED_THRESHOLD);
  assert.ok(importance("Rezoning Petition: 2025-011 by Garrison Road Holdings") >= TRACKED_THRESHOLD);
  assert.ok(importance("Set a Public Hearing on a Historic Landmark Designation") >= TRACKED_THRESHOLD);
});

test("meeting notices are not tracked, even when they contain budget language", () => {
  // Regression: these cleared the threshold on their own boilerplate and three
  // of them reached the deadline list with titles over 1,400 characters.
  const notice =
    "Upcoming meetings of the Board: Budget/Public Policy Workshop, Tuesday, September 22, 2026 at 2:30 p.m. Special Accommodations: Anyone needing special accommodations when attending this meeting and/or if this information is needed in an alternative format, please contact the Clerk to the Board.";
  assert.ok(importance(notice) < TRACKED_THRESHOLD, `expected below threshold, got ${importance(notice)}`);

  assert.ok(importance("Invocation and Pledge of Allegiance") < TRACKED_THRESHOLD);
  assert.ok(importance("Closed Session (as necessary)") < TRACKED_THRESHOLD);
  assert.ok(importance("Mayor and Council Topics") < TRACKED_THRESHOLD);
});

test("the recurring mission and vision block is not a decision", () => {
  const vision =
    'Mecklenburg Board of County Commissioners Community Vision "Mecklenburg County will be a community of pride and choice for people to live, learn, work and recreate." Board Mission: "To serve Mecklenburg County residents by helping improve their lives and community."';
  assert.ok(importance(vision) < TRACKED_THRESHOLD);
});

test("dateOnlyOrNull reads Legistar timestamps and rejects junk", () => {
  assert.equal(dateOnlyOrNull("2026-09-14T00:00:00"), "2026-09-14");
  assert.equal(dateOnlyOrNull(null), null);
  assert.equal(dateOnlyOrNull("n/a"), null);
});
