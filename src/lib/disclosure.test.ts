import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDisclosureReport, gapPercent, MONEY_TOPICS } from "./disclosure";
import type { Decision } from "@/types";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:1",
    slug: "charlotte-1-record",
    title: "A tracked record",
    organization: "charlotte",
    topic: "Development and rezoning",
    status: "Under review",
    summary: "Record text.",
    whyItMatters: "Impact.",
    latestUpdate: "Under review.",
    nextStep: null,
    publishedAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-01T12:00:00Z",
    affectedRoles: [],
    affectedZipCodes: [],
    affectedAreas: [],
    importantDates: [],
    isPublished: true,
    timeline: [
      {
        id: "t1",
        decisionId: "charlotte-legistar:1",
        date: "2026-08-01",
        stage: "Under review",
        title: "First tracked appearance",
        description: "Record text.",
        state: "current",
        verificationStatus: "verified",
      },
    ],
    sources: [
      {
        id: "s1",
        decisionId: "charlotte-legistar:1",
        title: "Official meeting record",
        organization: "Charlotte",
        url: "https://charlottenc.legistar.com/example",
        lastVerifiedAt: "2026-09-01T00:00:00Z",
        verificationStatus: "verified",
      },
    ],
    ...overrides,
  };
}

const NOW = new Date("2026-09-13T16:00:00Z");

test("an empty record set produces no division by zero", () => {
  const report = buildDisclosureReport([], { now: NOW });
  assert.equal(report.total, 0);
  for (const gap of report.gaps) {
    assert.equal(gap.share, 0);
    assert.equal(gapPercent(gap), 0);
  }
  assert.equal(report.stuck.count, 0);
  assert.equal(report.singleEvent.share, 0);
});

test("the cost meter counts against money records only", () => {
  const report = buildDisclosureReport(
    [
      decision({ id: "a", topic: MONEY_TOPICS[0] }),
      decision({ id: "b", topic: MONEY_TOPICS[0], money: { amountUsd: 1_250_000 } }),
      decision({ id: "c", topic: "Parks" }),
      decision({ id: "d", topic: "Roads" }),
    ],
    { now: NOW },
  );

  const cost = report.gaps.find((gap) => gap.key === "cost")!;
  assert.equal(cost.total, 2, "only budget and tax records form the denominator");
  assert.equal(cost.missing, 1);
  assert.equal(gapPercent(cost), 50);
});

test("the schedule meter counts against open records only", () => {
  const report = buildDisclosureReport(
    [
      decision({
        id: "open-dated",
        deadline: { date: "2026-09-28", origin: "official-tracker" },
      }),
      decision({ id: "open-undated" }),
      decision({ id: "closed", status: "Approved", approvedAt: "2026-09-01T12:00:00Z" }),
      decision({ id: "closed2", status: "Rejected" }),
    ],
    { now: NOW },
  );

  const schedule = report.gaps.find((gap) => gap.key === "schedule")!;
  assert.equal(schedule.total, 2);
  assert.equal(schedule.missing, 1);
  assert.equal(gapPercent(schedule), 50);
  assert.equal(report.open, 2);
  assert.equal(report.decided, 2);
});

test("the location meter accepts either the geography spine or a stated ZIP", () => {
  const report = buildDisclosureReport(
    [
      decision({
        id: "mapped",
        geography: { zipCode: "28205", method: "petition-match", confidence: "exact" },
      }),
      decision({ id: "text-zip", affectedZipCodes: ["28205"] }),
      decision({
        id: "unconfirmed",
        geography: { method: "none", confidence: "unconfirmed" },
      }),
      decision({ id: "nothing" }),
    ],
    { now: NOW },
  );

  const location = report.gaps.find((gap) => gap.key === "location")!;
  assert.equal(location.total, 4);
  assert.equal(report.located, 2);
  assert.equal(location.missing, 2);
});

test("an unconfirmed geography method does not count as located", () => {
  const report = buildDisclosureReport(
    [decision({ geography: { method: "none", confidence: "unconfirmed", zipCode: "28205" } })],
    { now: NOW },
  );
  assert.equal(report.located, 0);
});

test("stuck counts only long-open items with no recorded outcome", () => {
  const report = buildDisclosureReport(
    [
      // Open for 180 days, still at Under review: stuck.
      decision({ id: "stale", updatedAt: "2026-03-17T12:00:00Z" }),
      // Open, but recent: still normal.
      decision({ id: "fresh", updatedAt: "2026-09-10T12:00:00Z" }),
      // Old, but the record recorded a decision, so it is not stuck.
      decision({ id: "decided", status: "Approved", updatedAt: "2026-03-17T12:00:00Z" }),
      // Old and delayed: the body acted on it, so it is not stuck.
      decision({ id: "delayed", status: "Delayed", updatedAt: "2026-03-17T12:00:00Z" }),
    ],
    { now: NOW, staleDays: 120 },
  );

  assert.equal(report.stuck.count, 1);
  assert.equal(report.stuck.olderThanDays, 120);
  // Three records are open (the delayed one still is), so the share is 1 of 3.
  assert.equal(report.stuck.shareOfOpen, 0.333);
  assert.equal(report.open, 3);
});

test("singleEvent measures records that never produced a second action", () => {
  const report = buildDisclosureReport(
    [
      decision({ id: "one" }),
      decision({
        id: "two",
        timeline: [
          ...decision().timeline,
          {
            id: "t2",
            decisionId: "charlotte-legistar:1",
            date: "2026-09-01",
            stage: "Approved",
            title: "Approved",
            description: "Approved by Council",
            state: "completed",
            verificationStatus: "verified",
          },
        ],
      }),
    ],
    { now: NOW },
  );
  assert.equal(report.singleEvent.count, 1);
  assert.equal(gapPercent({ ...report.gaps[0], share: report.singleEvent.share }), 50);
});

test("the source meter catches a record with no official link", () => {
  const report = buildDisclosureReport(
    [decision({ id: "linked" }), decision({ id: "unlinked", sources: [] })],
    { now: NOW },
  );
  const source = report.gaps.find((gap) => gap.key === "source")!;
  assert.equal(source.missing, 1);
  assert.equal(gapPercent(source), 50);
});

test("the scope statement names the real counts and never generalises", () => {
  const report = buildDisclosureReport(
    [
      decision({ id: "a", organization: "charlotte" }),
      decision({ id: "b", organization: "charlotte" }),
      decision({ id: "c", organization: "mecklenburg-county" }),
      decision({
        id: "d",
        organization: "cms",
        publishedAt: "2026-08-20T12:00:00Z",
        updatedAt: "2026-08-20T12:00:00Z",
      }),
    ],
    { now: NOW },
  );

  assert.match(report.scopeStatement, /^Measured across the 4 local government records/);
  assert.ok(report.scopeStatement.includes("2 from Charlotte"));
  assert.ok(report.scopeStatement.includes("1 from Mecklenburg County"));
  assert.ok(report.scopeStatement.includes("1 from CMS"));
  assert.ok(report.scopeStatement.includes("not local government in general"));
  assert.equal(report.firstRecordDate, "2026-08-01");
  assert.equal(report.lastRecordDate, "2026-08-20");
});

test("organization totals always sum to the record count", () => {
  const decisions = [
    decision({ id: "a", organization: "charlotte" }),
    decision({ id: "b", organization: "cms" }),
    decision({ id: "c", organization: "cms" }),
  ];
  const report = buildDisclosureReport(decisions, { now: NOW });
  const sum = report.organizations.reduce((total, entry) => total + entry.total, 0);
  assert.equal(sum, 3);
});
