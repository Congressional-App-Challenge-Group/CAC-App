import assert from "node:assert/strict";
import { test } from "node:test";
import { agendaKind, agendaKindNote, schedulesNoVote } from "./agenda";

/*
 * Every label below was read off a live Mecklenburg County or Charlotte agenda
 * that CivicLens currently lists on its deadlines page. The first two are the
 * ones that were being reported as "Scheduled for vote" when they schedule none.
 */

test("a staff briefing and a manager's report schedule no vote", () => {
  assert.equal(agendaKind("Staff Briefings"), "informational");
  assert.equal(agendaKind("Manager’s Report"), "informational");
  assert.equal(schedulesNoVote("Staff Briefings"), true);
});

test("a commissioner reports section is informational, not a decision", () => {
  assert.equal(agendaKind("County Commissioners Reports & Requests"), "informational");
  assert.equal(agendaKind("Presentation"), "informational");
  assert.equal(agendaKind("Closed Session"), "informational");
});

test("consent, zoning and appointments are decisions", () => {
  assert.equal(agendaKind("Consent"), "decision");
  assert.equal(agendaKind("Zoning"), "decision");
  assert.equal(agendaKind("Appointments- Board of Equalization and Review"), "decision");
  assert.equal(schedulesNoVote("Consent"), false);
});

test("a public hearing is its own kind, because residents can be heard there", () => {
  assert.equal(agendaKind("Public Hearing"), "hearing");
  assert.equal(schedulesNoVote("Public Hearing"), false);
  assert.match(String(agendaKindNote("Public Hearing")), /heard/i);
});

test("an unexpected label makes no claim either way", () => {
  // The classifier reports that it does not know, and scheduling keeps the
  // earlier, cautious behavior: only a section that names itself informational is
  // withheld from the decision list. Guessing "informational" would quietly hide
  // a real vote.
  assert.equal(agendaKind("Something New"), "unknown");
  assert.equal(schedulesNoVote("Something New"), false);
  assert.equal(agendaKind("Agenda Ready"), "decision");
});

test("no label means no claim", () => {
  assert.equal(agendaKind(undefined), "unknown");
  assert.equal(agendaKind(""), "unknown");
  assert.equal(agendaKindNote(null), null);
  assert.equal(schedulesNoVote(undefined), false);
});

test("the note for an informational item says so plainly", () => {
  assert.match(String(agendaKindNote("Staff Briefings")), /schedules no vote/i);
});
