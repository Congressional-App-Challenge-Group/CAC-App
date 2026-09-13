import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyApprovedDrafts,
  buildSourceExcerpts,
  draftDecisionPlainLanguage,
  draftSummary,
  draftWhyItMatters,
  extractZoningChange,
  isTitleDuplicate,
  needsPlainLanguage,
  zoningTransition,
} from "./enrichment";
import type { Decision } from "@/types";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:29968",
    slug: "charlotte-29968-rezoning-petition",
    title: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
    organization: "charlotte",
    topic: "Development and rezoning",
    status: "Scheduled for vote",
    summary: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
    whyItMatters: "This item was identified as a substantive action in an official government meeting record.",
    latestUpdate: "Scheduled for vote as of 2026-09-01.",
    nextStep: "Scheduled government action on 2026-09-01.",
    publishedAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    affectedRoles: [],
    affectedZipCodes: [],
    affectedAreas: [],
    importantDates: [{ date: "2026-09-01", label: "Scheduled for vote" }],
    isPublished: true,
    timeline: [],
    sources: [
      {
        id: "s1",
        decisionId: "charlotte-legistar:29968",
        title: "Charlotte official meeting record",
        organization: "Charlotte",
        url: "https://charlottenc.legistar.com/example",
        lastVerifiedAt: "2026-09-01T00:00:00Z",
        verificationStatus: "verified",
      },
    ],
    ...overrides,
  };
}

test("isTitleDuplicate detects the 487-of-561 boilerplate case", () => {
  assert.equal(isTitleDuplicate("Rezoning Petition: 2025-011", "Rezoning Petition: 2025-011 by X"), true);
  assert.equal(
    isTitleDuplicate("A four-acre mixed-use rezoning on Garrison Road.", "Rezoning Petition: 2025-011"),
    false,
  );
});

test("needsPlainLanguage flags records still showing raw boilerplate", () => {
  assert.equal(needsPlainLanguage(decision()), true);
  assert.equal(
    needsPlainLanguage(
      decision({
        summary: "A distinct, editor-written summary of the petition.",
        whyItMatters: "This changes what can be built on the site.",
      }),
    ),
    false,
  );
});

test("draftSummary names the petition and never invents a cost or address", () => {
  const summary = draftSummary(decision());
  assert.match(summary, /2025-011/);
  assert.match(summary, /Garrison Road Holdings/);
  assert.doesNotMatch(summary, /\$\d/);
  assert.doesNotMatch(summary, /\b\d{2,6}\s+[A-Z][a-z]+\s+(Street|Road|Avenue)\b/);
});

test("draftSummary quotes the record only when the body adds information", () => {
  const withBody = draftSummary(
    decision({ summary: "The applicant proposes four storeys of residential above ground-floor retail." }),
  );
  assert.match(withBody, /The record states/);

  const withoutBody = draftSummary(decision());
  assert.doesNotMatch(withoutBody, /The record states/);
});

test("draftWhyItMatters uses the topic template and states the current stage", () => {
  const why = draftWhyItMatters(decision());
  assert.match(why, /Rezoning decides what may be built/);
  assert.match(why, /scheduled for vote/);
});

test("draftWhyItMatters only mentions a location the record supports", () => {
  const without = draftWhyItMatters(decision());
  assert.doesNotMatch(without, /It concerns/);

  const withGeography = draftWhyItMatters(
    decision({
      geography: {
        address: "4820 Colonial Avenue",
        neighborhood: "Sheffield Park",
        zipCode: "28205",
        method: "petition-match",
        confidence: "exact",
      },
    }),
  );
  assert.match(withGeography, /4820 Colonial Avenue/);
  assert.match(withGeography, /ZIP 28205/);
});

test("zoningTransition only reads a transition the record states verbatim", () => {
  assert.deepEqual(zoningTransition("Rezoning from R-3 to MX-2"), { from: "R-3", to: "MX-2" });
  assert.equal(zoningTransition("Rezoning petition with no stated transition"), null);
});

test("extractZoningChange returns null when no transition is stated", () => {
  assert.equal(extractZoningChange(decision()), null);
  assert.ok(
    extractZoningChange(decision({ summary: "Requested change from R-3 to MX-2 on the subject parcel." })),
  );
});

test("buildSourceExcerpts always includes the title and the official source", () => {
  const excerpts = buildSourceExcerpts(decision());
  assert.ok(excerpts.some((line) => line.startsWith("Title: ")));
  assert.ok(excerpts.some((line) => line.startsWith("Official source: ")));
});

test("draftDecisionPlainLanguage emits summary and why-it-matters drafts", () => {
  const drafts = draftDecisionPlainLanguage(decision());
  const fields = drafts.map((draft) => draft.field);
  assert.ok(fields.includes("summary"));
  assert.ok(fields.includes("whyItMatters"));
  assert.ok(fields.includes("nextStep"));
  for (const draft of drafts) {
    assert.ok(draft.draftText.length > 20);
    assert.equal(draft.decisionId, decision().id);
    assert.ok(draft.sourceExcerpts.length > 0);
  }
});

test("applyApprovedDrafts replaces only approved fields", () => {
  const applied = applyApprovedDrafts(decision(), [
    { field: "summary", draftText: "An editor-approved summary.", status: "approved" },
    { field: "whyItMatters", draftText: "A rejected note.", status: "rejected" },
    { field: "nextStep", draftText: "A pending note.", status: "pending" },
  ]);

  assert.equal(applied.summary, "An editor-approved summary.");
  assert.equal(applied.whyItMatters, decision().whyItMatters);
  assert.equal(applied.nextStep, decision().nextStep);
  assert.equal(applied.plainLanguageApproved, true);
});

test("applyApprovedDrafts leaves the record untouched when nothing is approved", () => {
  const original = decision();
  const applied = applyApprovedDrafts(original, [
    { field: "summary", draftText: "Pending summary.", status: "pending" },
  ]);
  assert.equal(applied.summary, original.summary);
  assert.equal(applied.plainLanguageApproved, undefined);
});
