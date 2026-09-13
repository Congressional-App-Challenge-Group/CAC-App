import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeId,
  changesSince,
  diffSnapshots,
  groupChangesByDecision,
  holdBackPipelineResolutions,
  toSnapshot,
} from "./changes";
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

test("diffSnapshots reports a newly scheduled action date as a change", () => {
  // A vote date being set is the single movement a resident most needs to hear
  // about, so the deadline itself is a comparable field.
  const before = toSnapshot([decision()], "2026-09-01T00:00:00.000Z");
  const after = [
    decision({
      deadline: { date: "2026-09-28", label: "Council agenda", origin: "official-tracker" },
      updatedAt: "2026-09-05T12:00:00Z",
    }),
  ];

  const changes = diffSnapshots(before, after);
  const deadline = changes.find((change) => change.field === "deadline");
  assert.ok(deadline);
  assert.equal(deadline?.previous, null);
  assert.equal(deadline?.current, "2026-09-28");
});

test("diffSnapshots ignores a deadline that only lost its date", () => {
  const before = toSnapshot(
    [decision({ deadline: { date: "2026-09-28", origin: "official-tracker" } })],
    "2026-09-01T00:00:00.000Z",
  );
  const after = [decision({ updatedAt: "2026-09-05T12:00:00Z" })];
  assert.equal(diffSnapshots(before, after).filter((c) => c.field === "deadline").length, 0);
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

test("holdBackPipelineResolutions removes only the fields the pipeline rewrote", () => {
  const before = toSnapshot(
    [decision({ id: "a" }), decision({ id: "b" })],
    "2026-09-01T00:00:00.000Z",
  );
  const after = [
    decision({ id: "a", status: "Approved", updatedAt: "2026-09-05T12:00:00Z" }),
    decision({ id: "b", status: "Rejected", updatedAt: "2026-09-05T12:00:00Z" }),
  ];

  const detected = diffSnapshots(before, after);
  const { changes, heldBack } = holdBackPipelineResolutions(detected, {
    producedAt: "2026-09-05T12:00:00Z",
    reason: "matter-register-resolution",
    entries: [{ decisionId: "a", fields: ["status"] }],
  });

  assert.equal(heldBack.length, 1);
  assert.equal(heldBack[0].decisionId, "a");
  assert.deepEqual(
    changes.map((change) => change.decisionId),
    ["b"],
    "a genuine change on an untouched record still reports",
  );
});

test("a held-back record still reports movement in a field the pipeline did not touch", () => {
  const before = toSnapshot([decision({ id: "a" })], "2026-09-01T00:00:00.000Z");
  const after = [
    decision({
      id: "a",
      status: "Approved",
      updatedAt: "2026-09-05T12:00:00Z",
      timeline: [
        {
          id: "t1",
          decisionId: "a",
          date: "2026-09-05",
          stage: "Approved",
          title: "Approved",
          description: "Approved by Council",
          state: "completed",
          verificationStatus: "verified",
        },
      ],
    }),
  ];

  const { changes, heldBack } = holdBackPipelineResolutions(diffSnapshots(before, after), {
    producedAt: "2026-09-05T12:00:00Z",
    reason: "matter-register-resolution",
    entries: [{ decisionId: "a", fields: ["status"] }],
  });

  assert.equal(heldBack.length, 1);
  assert.deepEqual(
    changes.map((change) => change.field),
    ["timeline"],
    "the real new action survives while the rewritten stage does not",
  );
});

test("holdBackPipelineResolutions is a no-op with no marker", () => {
  const before = toSnapshot([decision()], "2026-09-01T00:00:00.000Z");
  const after = [decision({ status: "Approved", updatedAt: "2026-09-05T12:00:00Z" })];
  const detected = diffSnapshots(before, after);

  const { changes, heldBack } = holdBackPipelineResolutions(detected, null);
  assert.equal(changes.length, detected.length);
  assert.equal(heldBack.length, 0);
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
