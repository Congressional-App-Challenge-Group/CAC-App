import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretQuestion,
  retrieveMatches,
  parseWindow,
  findTopics,
  findDistrictAssets,
  MAX_RECORDS_IN_ANSWER,
} from "./ask-retrieval";
import type { Decision } from "@/types";

/** A minimal Decision factory with only the fields retrieval touches. */
function decision(overrides: Partial<Decision> & Pick<Decision, "id" | "slug">): Decision {
  return {
    title: "",
    organization: "charlotte",
    topic: "",
    status: "Under review",
    summary: "",
    whyItMatters: "",
    latestUpdate: "",
    nextStep: null,
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-01",
    approvedAt: null,
    archivedAt: null,
    lastCheckedAt: null,
    affectedRoles: [],
    affectedZipCodes: [],
    affectedAreas: [],
    importantDates: [],
    isPublished: true,
    sources: [],
    timeline: [],
    ...overrides,
  };
}

const TODAY = "2026-10-20"; // fixed Tuesday for deterministic windows

test("parseWindow resolves 'this month' as real calendar bounds", () => {
  const w = parseWindow("What is scheduled for a vote this month?", TODAY);
  assert.deepEqual(w, { from: "2026-10-01", to: "2026-10-31" });
});

test("parseWindow resolves 'this week' forward from today, not from month start", () => {
  const w = parseWindow("What is happening this week?", TODAY);
  assert.deepEqual(w, { from: "2026-10-20", to: "2026-10-27" });
});

test("parseWindow resolves 'next month' including year rollover", () => {
  assert.deepEqual(parseWindow("next month", TODAY), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(parseWindow("next month", "2026-12-15"), { from: "2027-01-01", to: "2027-01-31" });
});

test("parseWindow resolves an explicit month; unparseable returns null", () => {
  assert.deepEqual(parseWindow("meetings in October 2026", TODAY), { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(parseWindow("anything at all sometime", TODAY), null);
});

test("interpretQuestion marks opinion questions as unsupported with a reason", () => {
  const r = interpretQuestion("Should the council approve the rezoning?", TODAY);
  assert.ok("unsupported" in r && typeof r.reason === "string" && r.reason.length > 20);
});

test("interpretQuestion marks outcome prediction as unsupported", () => {
  const r = interpretQuestion("How will the vote go?", TODAY);
  assert.ok("unsupported" in r);
});

test("interpretQuestion maps scheduled-vote intent to the deadline filter", () => {
  const scope = interpretQuestion("What is scheduled for a vote this month?", TODAY);
  if (!("unsupported" in scope)) {
    assert.equal(scope.intent, "scheduled-vote");
    assert.ok(scope.fromDate === "2026-10-01" && scope.toDate === "2026-10-31");
  } else {
    assert.fail("scheduled-vote question must not be unsupported");
  }
});

test("findTopics normalizes known synonyms and skips unknown words", () => {
  assert.deepEqual(findTopics("What about rezonings near schools?"), ["rezoning", "school"]);
  assert.deepEqual(findTopics("tell me about public transit"), ["transit"]);
  assert.deepEqual(findTopics("tell me about the moon"), []);
});
test("findDistrictAssets extracts ZIP and council district without inventing them", () => {
  assert.deepEqual(findDistrictAssets("votes in ZIP 28202 council district 3"), { zip: "28202", councilDistrict: 3 });
  assert.deepEqual(findDistrictAssets("just asking around"), {});
  // A 5-digit number that is not flagged as a ZIP is not treated as one.
  assert.deepEqual(findDistrictAssets("project 12345 costs"), {});
});

test("retrieveMatches: topic + status window + deadline window are all applied", () => {
  const inWindow = decision({
    id: "a", slug: "a", title: "Rezoning: 2025-036 Rangeworks", topic: "Rezoning",
    status: "Scheduled for vote", deadline: { date: "2026-10-12", label: "Public hearing", origin: "official-tracker" },
    sources: [{ id: "s1", decisionId: "a", title: "Agenda", organization: "Charlotte", url: "https://clt.legistar.com/x", lastVerifiedAt: "2026-10-01", verificationStatus: "verified" as const }],
  });
  const wrongMonth = decision({
    id: "b", slug: "b", title: "Rezoning: 2026-002", topic: "Rezoning",
    status: "Scheduled for vote", deadline: { date: "2027-03-02", label: "Hearing", origin: "official-tracker" },
  });
  const noDate = decision({ id: "c", slug: "c", title: "Rezoning: 2026-070", topic: "Rezoning", status: "Under review" });

  const { matches, dateGapPresent } = retrieveMatches([inWindow, wrongMonth, noDate], {
    statuses: [], topics: ["rezoning"], intent: "scheduled-vote",
    fromDate: "2026-10-01", toDate: "2026-10-31",
  }, TODAY);

  assert.deepEqual(matches.map((m) => m.id), ["a"]);
  // The topic-matched open record without a stated date is disclosed via the
  // gap flag — it cannot appear inside a date-filtered window.
  assert.equal(dateGapPresent, true);
});

test("retrieveMatches flags date gaps among matching open records with no stated date", () => {
  const noDate = decision({ id: "c", slug: "c", title: "Rezoning: no date", topic: "Rezoning", status: "Under review" });
  const scheduled = decision({
    id: "a", slug: "a", title: "Rezoning: dated", topic: "Rezoning", status: "Scheduled for vote",
    deadline: { date: "2026-10-12", label: "Hearing", origin: "official-tracker" },
  });
  const { dateGapPresent } = retrieveMatches([noDate, scheduled], {
    statuses: [], topics: ["rezoning"], intent: "scheduled-vote",
    fromDate: "2026-10-01", toDate: "2026-10-31",
  }, TODAY);
  assert.equal(dateGapPresent, true);
});

test("retrieveMatches: district asset narrows to that council district only", () => {
  const d3 = decision({ id: "d3", slug: "d3", title: "T3", topic: "x", geography: { councilDistrict: 3 } } as Partial<Decision> & Pick<Decision, "id" | "slug">);
  const d5 = decision({ id: "d5", slug: "d5", title: "T5", topic: "x", geography: { councilDistrict: 5 } } as Partial<Decision> & Pick<Decision, "id" | "slug">);
  const { matches } = retrieveMatches([d3, d5], {
    statuses: [], topics: [], intent: "any", councilDistrict: 3,
  }, TODAY);
  assert.deepEqual(matches.map((m) => m.id), ["d3"]);
});

test("retrieveMatches returns the sorted match set; composer applies the display cap", () => {
  const many = Array.from({ length: 20 }, (_, i) => decision({ id: `x${i}`, slug: `x${i}`, title: `T${i}`, topic: "y" }));
  const { matches, totalCandidates } = retrieveMatches(many, { statuses: [], topics: ["y"], intent: "any" }, TODAY);
  assert.equal(matches.length, many.length);
  assert.equal(totalCandidates, many.length);
  // The composer's display cap is separate from retrieval and bounded:
  assert.ok(MAX_RECORDS_IN_ANSWER > 0 && MAX_RECORDS_IN_ANSWER <= 10);
});

test("retrieveMatches skips unpublished records entirely", () => {
  const draft = decision({ id: "u", slug: "u", title: "Unpublished", topic: "y", isPublished: false });
  const pub = decision({ id: "p", slug: "p", title: "Published", topic: "y" });
  const { matches, totalCandidates } = retrieveMatches([draft, pub], { statuses: [], topics: ["y"], intent: "any" }, TODAY);
  assert.deepEqual(matches.map((m) => m.id), ["p"]);
  assert.equal(totalCandidates, 1);
});

test("retrieveMatches: no topic match yields empty set (a real searched-not-found)", () => {
  const r = retrieveMatches([decision({ id: "a", slug: "a", title: "Parks", topic: "Parks" })], {
    statuses: [], topics: ["budget"], intent: "any",
  }, TODAY);
  assert.equal(r.matches.length, 0);
});
