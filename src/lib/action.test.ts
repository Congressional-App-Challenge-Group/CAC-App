import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionsFor,
  calendarEventsFor,
  commentStarter,
  decidingBody,
  escapeIcsText,
  foldIcsLine,
  icsDate,
  representativesFor,
  toIcs,
} from "./action";
import type { Decision } from "@/types";

const NOW = new Date("2026-09-15T22:15:00Z"); // 6:15pm in Charlotte

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "charlotte-legistar:29968",
    slug: "charlotte-29968-affordable-housing-funding-policy",
    title: "Affordable Housing Funding Policy",
    organization: "charlotte",
    topic: "Housing",
    status: "Under review",
    summary: "A policy to direct housing bond proceeds.",
    whyItMatters: "It decides which households the bond money reaches.",
    latestUpdate: "Referred to committee on 2026-09-01.",
    nextStep: null,
    publishedAt: "2026-09-01T12:00:00Z",
    updatedAt: "2026-09-01T12:00:00Z",
    affectedRoles: [],
    affectedZipCodes: [],
    affectedAreas: [],
    importantDates: [],
    isPublished: true,
    timeline: [],
    sources: [
      {
        id: "s1",
        decisionId: "charlotte-legistar:29968",
        title: "Charlotte official meeting record",
        organization: "Charlotte",
        url: "https://example.test/record/29968",
        lastVerifiedAt: "2026-09-13T00:00:00Z",
        verificationStatus: "verified",
      },
    ],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Who decides                                                                 */
/* -------------------------------------------------------------------------- */

test("the deciding body comes from the publisher, which is always present", () => {
  assert.equal(decidingBody(decision()), "Charlotte City Council");
  assert.equal(
    decidingBody(decision({ organization: "mecklenburg-county" })),
    "Mecklenburg Board of County Commissioners",
  );
  assert.equal(decidingBody(decision({ organization: "cms" })), "CMS Board of Education");
});

test("a representative is only offered when the record can actually reach them", () => {
  const withAddress = decision({
    geography: {
      councilDistrict: 5,
      councilDistrictRep: "Dante Anderson",
      councilDistrictRepEmail: "Dante.Anderson@charlottenc.gov",
      method: "petition-match",
      confidence: "exact",
    },
  });
  const named = representativesFor(withAddress);
  assert.equal(named.length, 1);
  assert.equal(named[0].email, "Dante.Anderson@charlottenc.gov");

  // A name with no address still comes back, so the interface can say who holds
  // the seat even though there is no email action to offer.
  const namedOnly = decision({ geography: { councilDistrictRep: "Dante Anderson", method: "none", confidence: "unconfirmed" } });
  assert.equal(representativesFor(namedOnly)[0].email, undefined);
});

test("a record with no location names no representative", () => {
  assert.deepEqual(representativesFor(decision()), []);
});

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

test("a scheduled decision offers attending, dated to the register", () => {
  const actions = actionsFor(
    decision({
      deadline: { date: "2026-09-28", origin: "official-tracker", officialStatus: "Agenda Ready" },
    }),
    NOW,
  );
  const attend = actions.find((action) => action.kind === "attend");
  assert.ok(attend, "a scheduled matter must offer attendance");
  assert.match(attend!.title, /Charlotte City Council acts on this/);
  assert.equal(attend!.dueBy, "2026-09-28");
  assert.match(attend!.detail, /Agenda Ready/);
});

test("a decision being made today says so, rather than reading as past", () => {
  const actions = actionsFor(
    decision({ deadline: { date: "2026-09-15", origin: "official-tracker" } }),
    NOW,
  );
  assert.match(actions[0].title, /meets today/);
});

test("an open matter with no stated date asks when it will be heard, and offers no meeting", () => {
  // This is the discipline the layer exists for: without a published date there
  // is no meeting to send anyone to.
  const actions = actionsFor(decision(), NOW);
  assert.equal(actions.some((action) => action.kind === "attend"), false);
  const ask = actions.find((action) => action.kind === "ask");
  assert.ok(ask);
  assert.match(ask!.detail, /no date for the next action/);
});

test("a decided matter never offers a comment action", () => {
  const actions = actionsFor(
    decision({
      status: "Approved",
      approvedAt: "2026-08-24T00:00:00Z",
      geography: {
        councilDistrictRep: "Dante Anderson",
        councilDistrictRepEmail: "Dante.Anderson@charlottenc.gov",
        method: "petition-match",
        confidence: "exact",
      },
    }),
    NOW,
  );
  assert.equal(
    actions.some((action) => action.kind === "contact" && action.to),
    false,
    "emailing a representative to oppose something already decided wastes their time",
  );
  assert.equal(actions[0].kind, "read");
  assert.match(actions[0].detail, /approved/i);
});

test("a reachable representative is offered as a direct email action", () => {
  const actions = actionsFor(
    decision({
      geography: {
        councilDistrict: 5,
        councilDistrictRep: "Dante Anderson",
        councilDistrictRepEmail: "Dante.Anderson@charlottenc.gov",
        method: "petition-match",
        confidence: "exact",
      },
    }),
    NOW,
  );
  const contact = actions.find((action) => action.kind === "contact");
  assert.ok(contact);
  assert.equal(contact!.to, "Dante.Anderson@charlottenc.gov");
  assert.match(contact!.href ?? "", /^mailto:Dante\.Anderson@charlottenc\.gov\?subject=/);
  assert.match(decodeURIComponent(contact!.href!), /My comment:/);
});

test("the action list stays short enough to be a plan", () => {
  const actions = actionsFor(
    decision({
      status: "Approved",
      deadline: { date: "2026-09-28", origin: "official-tracker" },
      importantDates: [{ date: "2026-10-01", label: "Report due" }],
      geography: {
        councilDistrictRep: "Dante Anderson",
        councilDistrictRepEmail: "a@b.gov",
        countyDistrictRep: "Elaine Powell",
        countyDistrictRepEmail: "c@d.gov",
        method: "petition-match",
        confidence: "exact",
      },
    }),
    NOW,
  );
  assert.ok(actions.length <= 4, `expected at most 4 actions, got ${actions.length}`);
});

test("a record with nothing known still points somewhere real", () => {
  const actions = actionsFor(
    decision({ organization: "cms", topic: "Education" }),
    NOW,
  );
  assert.ok(actions.length >= 1);
  assert.ok(actions[0].href?.startsWith("https://"));
});

/* -------------------------------------------------------------------------- */
/* Comment starter                                                             */
/* -------------------------------------------------------------------------- */

test("the comment starter states the record and leaves the opinion blank", () => {
  const text = commentStarter(
    decision({
      geography: {
        councilDistrict: 5,
        countyDistrict: 1,
        zipCode: "28205",
        address: "8212 Douglas Dr",
        method: "petition-match",
        confidence: "exact",
      },
      importantDates: [{ date: "2026-09-28", label: "Next scheduled action" }],
    }),
  );

  assert.match(text, /Affordable Housing Funding Policy/);
  assert.match(text, /lists as under review/);
  assert.match(text, /City Council District 5/);
  assert.match(text, /The record places this at 8212 Douglas Dr/);
  assert.match(text, /Referred to committee/);
  assert.match(text, /2026-09-28/);
  // The opinion is the resident's, and the template says so by leaving it empty.
  assert.match(text, /My comment:\s*\n\s*\n/);
  assert.match(text, /charlotte-legistar:29968/);
});

test("the comment starter never puts the record's location in the writer's mouth", () => {
  const located = commentStarter(
    decision({
      geography: {
        zipCode: "28205",
        address: "8212 Douglas Dr",
        method: "petition-match",
        confidence: "exact",
      },
    }),
  );

  // The address the decision concerns is attributed to the record...
  assert.match(located, /The record places this at 8212 Douglas Dr/);
  // ...and never claimed as the writer's home. A bracketed prompt is left instead.
  assert.equal(/I live in (?!\[)/.test(located), false);
  // The record's ZIP is not printed as the writer's own.
  assert.equal(/ZIP 28205/.test(located), false);
  assert.match(located, /ZIP \[your ZIP code\]/);
});

/* -------------------------------------------------------------------------- */
/* Calendar                                                                    */
/* -------------------------------------------------------------------------- */

test("an event is exported as an all-day date, never an invented time", () => {
  const events = calendarEventsFor(
    decision({ deadline: { date: "2026-09-28", origin: "official-tracker" } }),
    NOW,
  );
  assert.equal(events.length, 1);

  const ics = toIcs(events, { name: "CivicLens", now: NOW });
  assert.match(ics, /DTSTART;VALUE=DATE:20260928/);
  assert.match(ics, /DTEND;VALUE=DATE:20260929/);
  // A time would be a fabricated detail: the record only states a day.
  assert.equal(/DTSTART;TZID|DTSTART:\d{8}T/.test(ics), false);
  assert.match(ics, /SUMMARY:Charlotte City Council: Affordable Housing Funding Policy/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /END:VCALENDAR/);
});

test("every dated step on the record is exported once", () => {
  const events = calendarEventsFor(
    decision({
      deadline: { date: "2026-09-28", origin: "official-tracker" },
      importantDates: [
        { date: "2026-09-28", label: "Next scheduled action" },
        { date: "2026-10-01", label: "Report due" },
      ],
    }),
    NOW,
  );
  assert.equal(events.length, 2, "the same date must not appear twice");
  assert.deepEqual(events.map((event) => event.date), ["2026-09-28", "2026-10-01"]);
});

test("a record with no dates produces no events rather than an empty one", () => {
  assert.deepEqual(calendarEventsFor(decision(), NOW), []);
});

test("calendar text escapes the characters that are field separators and newlines", () => {
  assert.equal(escapeIcsText("a, b; c"), "a\\, b\\; c");
  assert.equal(escapeIcsText("line one\nline two"), "line one\\nline two");
  // Backslash first, or the escapes added after would themselves be escaped.
  assert.equal(escapeIcsText("C:\\path"), "C:\\\\path");
});

test("a long title is folded to the octet limit RFC 5545 sets", () => {
  const long = `SUMMARY:${"a".repeat(200)}`;
  const folded = foldIcsLine(long);
  const lines = folded.split("\r\n");
  assert.ok(lines.length > 1, "a 200-character line must be folded");
  for (const line of lines.slice(1)) {
    assert.equal(line.startsWith(" "), true, "continuation lines begin with a space");
  }
  for (const line of lines) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line exceeded 75 octets: ${line.length}`);
  }
  // Unfolding must reproduce the original exactly.
  assert.equal(lines.map((line, index) => (index ? line.slice(1) : line)).join(""), long);
});

test("folding counts octets, not characters, so non-ASCII titles survive", () => {
  // Each em dash is three octets in UTF-8. Counting characters would let the
  // line overflow and a calendar client could truncate the event title.
  const line = `SUMMARY:${"—".repeat(40)}`;
  const folded = foldIcsLine(line);
  for (const part of folded.split("\r\n")) {
    assert.ok(Buffer.byteLength(part, "utf8") <= 75, "folded line exceeded 75 octets");
  }
  assert.equal(folded.split("\r\n").map((p, i) => (i ? p.slice(1) : p)).join(""), line);
});

test("the DATE form drops hyphens and nothing else", () => {
  assert.equal(icsDate("2026-09-28"), "20260928");
  assert.equal(icsDate("2026-09-28T00:00:00"), "20260928");
});

test("a generated file uses CRLF line endings throughout", () => {
  const events = calendarEventsFor(
    decision({ deadline: { date: "2026-09-28", origin: "official-tracker" } }),
    NOW,
  );
  const ics = toIcs(events, { now: NOW });

  const lines = ics.split("\n");
  // Split on LF: every element except the trailing empty one must carry the CR.
  for (const line of lines.slice(0, -1)) {
    assert.ok(line.endsWith("\r"), `line without CRLF: ${line}`);
  }
  assert.equal(lines.at(-1), "");
  assert.equal(/[^\r]\n/.test(ics), false, "a bare LF would be an invalid line break");
});
