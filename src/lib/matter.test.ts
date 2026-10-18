import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalMatterKey,
  collapseToMatters,
  furthestStatus,
  isProceduralEntity,
  mergeAppearances,
  normalizeTitle,
  proceduralReason,
  reconcileArtifacts,
  stageRank,
} from "./matter";
import type { Decision, DecisionStatus, TimelineEvent } from "@/types";

function event(date: string, stage: DecisionStatus, title: string): TimelineEvent {
  return {
    id: `${date}-${stage}`,
    decisionId: "x",
    date,
    stage,
    title,
    description: "",
    state: "completed",
    verificationStatus: "verified",
  };
}

function appearance(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:29969",
    slug: "charlotte-29969-rezoning-petition-2025-036-by-rangeworks",
    title: "Rezoning Petition: 2025-036 by Rangeworks",
    organization: "charlotte",
    topic: "Development and rezoning",
    status: "Under review",
    summary: "Rezoning Petition: 2025-036",
    whyItMatters: "Rezoning decides what may be built on one site.",
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

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

test("a petition number outranks the matter id, because the matter id changes every meeting", () => {
  const a = canonicalMatterKey({
    organization: "charlotte",
    id: "charlotte-legistar:28286",
    title: "Rezoning Petition: 2025-036 by Rangeworks",
  });
  const b = canonicalMatterKey({
    organization: "charlotte",
    id: "charlotte-legistar:29969",
    title: "Rezoning Petition: 2025-036 by Rangeworks",
  });
  assert.equal(a, "petition:charlotte:2025-036");
  assert.equal(a, b, "the same petition must be one matter whatever its matter id is");
});

test("a non-rezoning record falls back to its official matter id", () => {
  assert.equal(
    canonicalMatterKey({
      organization: "mecklenburg-county",
      id: "mecklenburg-legistar:12938",
      title: "Budget Amendment - Department of Child, Family, and Adult Services",
    }),
    "matter:mecklenburg-county:12938",
  );
});

test("an id with no official matter number falls back to the record's own title", () => {
  const key = canonicalMatterKey({
    organization: "charlotte",
    id: "charlotte-legistar:public-hearing",
    title: "Affordable Housing Funding Policy",
  });
  assert.equal(key, "title:charlotte:affordable housing funding policy");
});

test("title normalization ignores case and punctuation but not words", () => {
  assert.equal(normalizeTitle("Budget Amendment — FY2027 (Revised)"), "budget amendment fy2027 revised");
  assert.notEqual(normalizeTitle("Budget Amendment"), normalizeTitle("Budget Adjustments"));
});

/* -------------------------------------------------------------------------- */
/* Procedural notices                                                          */
/* -------------------------------------------------------------------------- */

test("meeting-shaped entities are recognised as notices rather than decisions", () => {
  const notices = [
    "Public Hearings - 6:30 PM",
    "9:00 AM City Council Housing Committee Meeting",
    "Removed: 6:00 PM Construction Contract Pressley Road Park",
    "Upcoming Meetings of the Board",
    "Invocation",
  ];
  for (const title of notices) {
    assert.equal(isProceduralEntity(title), true, `expected notice: ${title}`);
  }
});

test("a petition number always proves substance, whatever else the title says", () => {
  assert.equal(isProceduralEntity("Rezoning Petition: 2025-036 by Rangeworks"), false);
  assert.equal(
    isProceduralEntity("Public Hearing: Rezoning Petition 2026-004"),
    false,
    "a hearing about a named petition is a real item",
  );
});

/**
 * The regression that matters most.
 *
 * A public hearing is a *stage* of a real decision, and Charlotte and
 * Mecklenburg publish the decision itself under a hearing heading. An earlier,
 * wider filter treated every "Public Hearing…" title as a notice and silently
 * removed these from the index.
 */
test("a hearing with a subject is a decision, not a notice", () => {
  const decisions = [
    "Public Hearing on General Obligation Bond Referendum",
    "Public Hearing: Recommended Budget for FY2026-2027",
    "Public Hearing - Uniform Schedules of Values, Standards and Rules for the 2027 County-wide Reappraisal",
    "Public Hearing - Business Location and Expansion - AVERITT EXPRESS, INC.",
    "Public Hearing and Decision on a Resolution to Close a Portion of Pete Brown Road",
    "Public Hearing - Flood Mitigation Program, Retrofit Program Policy Update",
    "Public Hearing - Suttle Avenue Name Change",
  ];
  for (const title of decisions) {
    assert.equal(isProceduralEntity(title), false, `must not be set aside: ${title}`);
  }
});

test("a hearing entry naming no subject is still a notice", () => {
  for (const title of ["Public Hearings - 6:30 PM", "PUBLIC HEARING", "Public Hearings - None"]) {
    assert.equal(isProceduralEntity(title), true, `expected a notice: ${title}`);
  }
});

test("a substantive title that merely mentions a meeting is kept", () => {
  assert.equal(
    isProceduralEntity(
      "Consideration of adjustments from the May 18, 2026, City Council Budget Adjustments Meeting",
    ),
    false,
  );
});

test("set-aside rows carry a reason specific to why they were set aside", () => {
  assert.match(proceduralReason("Public Hearings - 6:30 PM") ?? "", /no subject/i);
  assert.match(proceduralReason("REMOVED: 26-0342: Construction Contract - Pressley Road Park") ?? "", /agenda/i);
  assert.equal(proceduralReason("Affordable Housing Funding Policy"), null);
});

test("ordinary decisions are never mistaken for notices", () => {
  const real = [
    "Affordable Housing Funding Policy",
    "Budget Amendment - Department of Child, Family, and Adult Services",
    "I-77 South Express Lanes Project",
    "Ordinance to amend the zoning map",
  ];
  for (const title of real) {
    assert.equal(isProceduralEntity(title), false, `expected a real decision: ${title}`);
  }
});

/* -------------------------------------------------------------------------- */
/* Stage precedence                                                            */
/* -------------------------------------------------------------------------- */

test("the furthest stage wins, and a terminal stage outranks every open one", () => {
  assert.equal(furthestStatus(["Under review", "Scheduled for vote"]), "Scheduled for vote");
  assert.equal(furthestStatus(["Under review", "Approved"]), "Approved");
  assert.equal(furthestStatus(["Delayed", "Under review"]), "Delayed");
  assert.equal(furthestStatus(["Withdrawn", "Delayed"]), "Withdrawn");
  assert.ok(stageRank("Approved") > stageRank("Scheduled for vote"));
  assert.ok(stageRank("Scheduled for vote") > stageRank("Under review"));
});

/* -------------------------------------------------------------------------- */
/* Merging                                                                     */
/* -------------------------------------------------------------------------- */

test("ten appearances of one petition become one matter, and nothing is lost", () => {
  const ids = ["28286", "28455", "28555", "28694", "28850", "29016", "29300", "29446", "29776", "29969"];
  const appearances = ids.map((matterId, index) => {
    // Ten distinct meeting dates, mirroring the real petition which appears on
    // one agenda per month from October 2025 to September 2026.
    const month = String(index + 1).padStart(2, "0");
    return appearance({
      id: `charlotte-legistar:${matterId}`,
      slug: `charlotte-${matterId}-rezoning-petition-2025-036-by-rangeworks`,
      publishedAt: `2026-${month}-01T12:00:00Z`,
      updatedAt: `2026-${month}-01T12:00:00Z`,
      timeline: [event(`2026-${month}-01`, "Under review", "Reviewed by government body")],
      sources: [
        {
          id: `s-${matterId}`,
          decisionId: `charlotte-legistar:${matterId}`,
          title: "Charlotte official meeting record",
          organization: "Charlotte",
          url: `https://example.test/meetings/${matterId}`,
          lastVerifiedAt: "2026-09-13T00:00:00Z",
          verificationStatus: "verified",
        },
      ],
    });
  });

  const { matters } = collapseToMatters(appearances, new Date("2026-09-13T00:00:00Z"));

  assert.equal(matters.length, 1, "one petition must be one matter");
  const matter = matters[0];
  assert.equal(matter.matterKey, "petition:charlotte:2025-036");
  assert.equal(matter.appearanceCount, 10);
  assert.equal(matter.appearanceIds?.length, 10);
  assert.equal(matter.sources.length, 10, "every official record stays attached");
  assert.equal(matter.timeline.length, 10, "the appearances become the timeline");
});

test("identical events recorded by two appearances are not counted twice", () => {
  const shared = event("2026-05-05", "Under review", "Reviewed by government body");
  const merged = mergeAppearances(
    [
      appearance({ id: "charlotte-legistar:1", publishedAt: "2026-05-05T12:00:00Z", timeline: [shared] }),
      appearance({
        id: "charlotte-legistar:2",
        publishedAt: "2026-06-05T12:00:00Z",
        timeline: [{ ...shared, id: "other" }],
      }),
    ],
    "petition:charlotte:2025-036",
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(merged.timeline.length, 1);
});

test("the merged record spans first appearance to latest activity", () => {
  const merged = mergeAppearances(
    [
      appearance({ id: "charlotte-legistar:1", publishedAt: "2025-10-07T12:00:00Z", updatedAt: "2025-10-07T12:00:00Z" }),
      appearance({ id: "charlotte-legistar:2", publishedAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z" }),
    ],
    "petition:charlotte:2025-036",
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(merged.publishedAt, "2025-10-07T12:00:00Z");
  assert.equal(merged.updatedAt, "2026-09-01T12:00:00Z");
  assert.equal(merged.firstSeenAt, "2025-10-07T12:00:00Z");
  assert.equal(merged.lastActivityAt, "2026-09-01T12:00:00Z");
});

test("the most advanced appearance supplies the stage and the id", () => {
  const merged = mergeAppearances(
    [
      appearance({ id: "charlotte-legistar:1", status: "Under review" }),
      appearance({ id: "charlotte-legistar:2", status: "Scheduled for vote" }),
    ],
    "petition:charlotte:2025-036",
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(merged.status, "Scheduled for vote");
  assert.equal(merged.id, "charlotte-legistar:2");
});

test("the location kept is the most trustworthy one, not the most recent", () => {
  const merged = mergeAppearances(
    [
      appearance({
        id: "charlotte-legistar:1",
        updatedAt: "2026-09-01T12:00:00Z",
        geography: { method: "none", confidence: "unconfirmed" },
      }),
      appearance({
        id: "charlotte-legistar:2",
        updatedAt: "2025-01-01T12:00:00Z",
        geography: { method: "petition-match", confidence: "exact", zipCode: "28205", councilDistrict: 5, acres: 4.5 },
      }),
    ],
    "petition:charlotte:2025-036",
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(merged.geography?.confidence, "exact");
  assert.equal(merged.geography?.zipCode, "28205");
});

test("the deadline kept is the soonest one still ahead", () => {
  const merged = mergeAppearances(
    [
      appearance({
        id: "charlotte-legistar:1",
        deadline: { date: "2026-12-01", origin: "official-tracker" },
      }),
      appearance({
        id: "charlotte-legistar:2",
        deadline: { date: "2026-09-15", origin: "official-tracker" },
      }),
      appearance({
        id: "charlotte-legistar:3",
        deadline: { date: "2026-01-05", origin: "official-tracker" },
      }),
    ],
    "petition:charlotte:2025-036",
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(merged.deadline?.date, "2026-09-15");
});

/* -------------------------------------------------------------------------- */
/* Collapse                                                                    */
/* -------------------------------------------------------------------------- */

test("collapse reports what it sets aside instead of deleting it quietly", () => {
  const { matters, excluded } = collapseToMatters(
    [
      appearance({ id: "mecklenburg-legistar:public-hearings-6-30-pm", title: "Public Hearings - 6:30 PM", organization: "mecklenburg-county" }),
      appearance({ id: "charlotte-legistar:29968", title: "Affordable Housing Funding Policy" }),
    ],
    new Date("2026-09-13T00:00:00Z"),
  );

  assert.equal(matters.length, 1);
  assert.equal(excluded.length, 1);
  assert.equal(excluded[0].title, "Public Hearings - 6:30 PM");
  assert.match(excluded[0].reason, /notice/i);
});

test("a slug retired by merging keeps working as an alias", () => {
  const { matters, aliases } = collapseToMatters(
    [
      appearance({ id: "charlotte-legistar:1", slug: "old-slug", publishedAt: "2025-10-07T12:00:00Z" }),
      appearance({ id: "charlotte-legistar:2", slug: "new-slug", publishedAt: "2026-09-01T12:00:00Z" }),
    ],
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(matters.length, 1);
  assert.equal(matters[0].slug, "new-slug");
  assert.equal(aliases["old-slug"], "new-slug");
});

test("different petitions stay separate matters", () => {
  const { matters } = collapseToMatters(
    [
      appearance({ id: "charlotte-legistar:1", title: "Rezoning Petition: 2025-036 by Rangeworks" }),
      appearance({ id: "charlotte-legistar:2", title: "Rezoning Petition: 2025-077 by Short Development Group, LLC" }),
    ],
    new Date("2026-09-13T00:00:00Z"),
  );
  assert.equal(matters.length, 2);
});

/* -------------------------------------------------------------------------- */
/* Artifact reconciliation                                                     */
/* -------------------------------------------------------------------------- */

test("a slug retired by an earlier run is not forgotten by a later one", () => {
  // This is the plain failure the merge exists to prevent: running `pnpm
  // collapse` a second time destroyed every alias recorded by the first, because
  // the collapsed input no longer contains the old slugs.
  const { aliases, excluded } = reconcileArtifacts({
    previousAliases: { "old-slug": "survivor" },
    previousExcluded: [],
    aliases: {},
    excluded: [],
    matters: [{ id: "charlotte-legistar:2", slug: "survivor" }],
  });

  assert.equal(aliases["old-slug"], "survivor");
  assert.equal(excluded.length, 0);
});

test("the audit trail survives a re-run over already-collapsed data", () => {
  const audit = [
    { id: "mecklenburg-legistar:public-hearings-6-30-pm", title: "Public Hearings - 6:30 PM", organization: "mecklenburg-county", reason: "Hearing notice with no subject." },
  ];
  const { excluded } = reconcileArtifacts({
    previousAliases: {},
    previousExcluded: audit,
    aliases: {},
    excluded: [],
    matters: [{ id: "charlotte-legistar:29968", slug: "affordable-housing" }],
  });
  assert.equal(excluded.length, 1);
  assert.equal(excluded[0].reason, "Hearing notice with no subject.");
});

test("a record brought back into the index is dropped from the exclusion list", () => {
  const { excluded } = reconcileArtifacts({
    previousAliases: {},
    previousExcluded: [
      { id: "charlotte-legistar:5", title: "Public Hearing - Bond Referendum", organization: "charlotte", reason: "Hearing notice with no subject." },
    ],
    aliases: {},
    excluded: [],
    matters: [{ id: "charlotte-legistar:5", slug: "bond-referendum" }],
  });
  assert.equal(excluded.length, 0, "a published record cannot also be listed as set aside");
});

test("an alias chain resolves to its final destination", () => {
  const { aliases } = reconcileArtifacts({
    previousAliases: { "a": "b" },
    previousExcluded: [],
    aliases: { "b": "c" },
    excluded: [],
    matters: [{ id: "charlotte-legistar:9", slug: "c" }],
  });
  assert.equal(aliases["a"], "c");
  assert.equal(aliases["b"], "c");
});

test("a slug that is live again is not retired, and no slug aliases itself", () => {
  const { aliases } = reconcileArtifacts({
    previousAliases: { "now-live": "elsewhere", "same": "same" },
    previousExcluded: [],
    aliases: {},
    excluded: [],
    matters: [{ id: "charlotte-legistar:7", slug: "now-live" }],
  });
  assert.equal(aliases["now-live"], undefined);
  assert.equal(aliases["same"], undefined);
});

test("collapse is idempotent once its artifacts accumulate", () => {
  const source = [
    appearance({ id: "charlotte-legistar:1", slug: "old-slug", publishedAt: "2025-10-07T12:00:00Z" }),
    appearance({ id: "charlotte-legistar:2", slug: "new-slug", publishedAt: "2026-09-01T12:00:00Z" }),
    appearance({ id: "mecklenburg-legistar:notices", slug: "notices", organization: "mecklenburg-county", title: "Public Hearings - 6:30 PM" }),
  ];

  const first = collapseToMatters(source, new Date("2026-09-13T00:00:00Z"));
  const artifacts = reconcileArtifacts({
    previousAliases: {},
    previousExcluded: [],
    aliases: first.aliases,
    excluded: first.excluded,
    matters: first.matters,
  });

  // Exactly what a re-run sees: the published matters, with the set-aside rows
  // and the retired slugs already gone.
  const second = collapseToMatters(first.matters, new Date("2026-09-13T00:00:00Z"));
  const again = reconcileArtifacts({
    previousAliases: artifacts.aliases,
    previousExcluded: artifacts.excluded,
    aliases: second.aliases,
    excluded: second.excluded,
    matters: second.matters,
  });

  assert.deepEqual(
    second.matters.map((matter) => matter.id),
    first.matters.map((matter) => matter.id),
  );
  assert.deepEqual(again.aliases, artifacts.aliases);
  assert.deepEqual(
    again.excluded.map((row) => row.id),
    artifacts.excluded.map((row) => row.id),
  );
});
