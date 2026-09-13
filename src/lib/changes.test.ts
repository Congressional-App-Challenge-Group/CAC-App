import assert from "node:assert/strict";
import { test } from "node:test";
import { changeId, changesSince, diffSnapshots, groupChangesByDecision, toSnapshot } from "./changes";
import type { Decision } from "@/types";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:29968",
    slug: "charlotte-29968-rezoning-petition",
    title: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
    organization: "charlotte",
    topic: "Development and rezoning",
    status: "Under review",
    summary: "Rezoning Petition: 2025-011",
    whyItMatters: "Identified as a substantive action.",
    latestUpdate: "Under review as of 2026-09-01.",
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

test("diffSnapshots reports a status change", () => {
  const before = toSnapshot([decision()], "2026-09-01T00:00:00.000Z");
  const after = [decision({ status: "Approved", updatedAt: "2026-09-05T12:00:00Z" })];

  const changes = diffSnapshots(before, after);
  const statusChange = changes.find((change) => change.field === "status");

  assert.equal(changes.length, 1);
  assert.equal(statusChange?.previous, "Under review");
  assert.equal(statusChange?.current, "Approved");
  assert.equal(statusChange?.changedAt, "2026-09-05T12:00:00Z");
});

test("diffSnapshots does not treat a first appearance as a change", () => {
  const before = toSnapshot([], "2026-09-01T00:00:00.000Z");
  const changes = diffSnapshots(before, [decision()]);
  assert.equal(changes.length, 0);
});

test("diffSnapshots ignores identical snapshots", () => {
  const records = [decision()];
  const before = toSnapshot(records, "2026-09-01T00:00:00.000Z");
  assert.equal(diffSnapshots(before, records).length, 0);
});

test("diffSnapshots detects a new timeline action", () => {
  const before = toSnapshot([decision({ timeline: [] })], "2026-09-01T00:00:00.000Z");
  const after = [
    decision({
      updatedAt: "2026-09-06T12:00:00Z",
      timeline: [
        {
          id: "t1",
          decisionId: "charlotte-legistar:29968",
          date: "2026-09-06",
          stage: "Approved",
          title: "Approved",
          description: "Approved by Council",
          state: "completed",
          verificationStatus: "verified",
        },
      ],
    }),
  ];

  const changes = diffSnapshots(before, after);
  assert.ok(changes.some((change) => change.field === "timeline"));
});

test("diffSnapshots ignores a timeline that shrank, which usually means a re-parse", () => {
  const event = {
    id: "t1",
    decisionId: "charlotte-legistar:29968",
    date: "2026-09-06",
    stage: "Approved" as const,
    title: "Approved",
    description: "Approved by Council",
    state: "completed" as const,
    verificationStatus: "verified" as const,
  };
  const before = toSnapshot([decision({ timeline: [event] })], "2026-09-01T00:00:00.000Z");
  const after = [decision({ timeline: [], updatedAt: "2026-09-07T12:00:00Z" })];

  const changes = diffSnapshots(before, after);
  assert.equal(changes.filter((change) => change.field === "timeline").length, 0);
});

test("diffSnapshots respects a maxAgeDays window", () => {
  const before = toSnapshot([decision()], "2020-01-01T00:00:00.000Z");
  const after = [decision({ status: "Rejected", updatedAt: "2020-01-02T00:00:00Z" })];
  assert.equal(diffSnapshots(before, after, { maxAgeDays: 30 }).length, 0);
});

test("changeId is stable for the same change", () => {
  assert.equal(
    changeId("d1", "status", "2026-09-05T12:00:00Z"),
    changeId("d1", "status", "2026-09-05T12:00:00Z"),
  );
});

test("groupChangesByDecision groups multiple fields on one record", () => {
  const before = toSnapshot([decision()], "2026-09-01T00:00:00.000Z");
  const after = [
    decision({
      status: "Approved",
      nextStep: "Construction begins 2027",
      updatedAt: "2026-09-05T12:00:00Z",
    }),
  ];

  const groups = groupChangesByDecision(diffSnapshots(before, after));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].changes.length, 2);
  assert.ok(groups[0].changes.some((change) => change.field === "nextStep"));
});

test("changesSince filters to the requested window", () => {
  const changes = [
    {
      id: "a",
      decisionId: "d",
      slug: "s",
      title: "t",
      organization: "charlotte" as const,
      field: "status" as const,
      previous: null,
      current: "Approved",
      changedAt: new Date().toISOString(),
    },
    {
      id: "b",
      decisionId: "d",
      slug: "s",
      title: "t",
      organization: "charlotte" as const,
      field: "status" as const,
      previous: null,
      current: "Approved",
      changedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    },
  ];

  assert.equal(changesSince(changes, 7).length, 1);
});
