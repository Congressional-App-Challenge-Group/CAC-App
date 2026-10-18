import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NO_OUTCOME_STATED,
  govSources,
  publisherStatesOutcomes,
  unstatedOutcomeNote,
} from "./sources";
import { orgNames } from "./civic";

/* -------------------------------------------------------------------------- */
/* Publisher capability                                                        */
/* -------------------------------------------------------------------------- */

test("a publisher that states outcomes is distinguished from one that does not", () => {
  assert.equal(publisherStatesOutcomes("charlotte"), true);
  assert.equal(publisherStatesOutcomes("mecklenburg-county"), true);
  // Durham's agenda items carry no action text and no passed flag, and no pass
  // date has been populated for any Durham matter since 2025.
  assert.equal(publisherStatesOutcomes("durham-county"), false);
});

test("every organisation the app names has a source entry and a display name", () => {
  // A missing entry would make publisherStatesOutcomes fall back to `true` and
  // quietly claim an outcome the publisher never states.
  for (const source of govSources) {
    assert.ok(orgNames[source.organization], `${source.organization} has no display name`);
    assert.ok(source.url.startsWith("https://"), `${source.key} needs an https source url`);
  }
});

/* -------------------------------------------------------------------------- */
/* The update line                                                             */
/* -------------------------------------------------------------------------- */

test("a publisher that states outcomes keeps the original wording", () => {
  const quoted = "The government's own matter record lists this as “Agenda Ready”";
  assert.equal(
    unstatedOutcomeNote("charlotte", quoted),
    `${quoted}. The register states no date for its next action.`,
  );
});

test("a publisher that states no outcome says so rather than implying it is pending", () => {
  const quoted = "The government's own matter record lists this as “Consent Agenda”";
  const note = unstatedOutcomeNote("durham-county", quoted);

  assert.match(note, /Consent Agenda/);
  assert.match(note, /does not state what happened/);
  // The distinction the sentence exists for: unknown is not pending.
  assert.match(note, /unknown rather than pending/);
  assert.equal(note.includes("states no date for its next action"), false);
});

test("the update line is a pure function of the register, so runs cannot stack", () => {
  const quoted = "The government's own matter record lists this as “Other Business”";
  const first = unstatedOutcomeNote("durham-county", quoted);
  const second = unstatedOutcomeNote("durham-county", quoted);
  assert.equal(first, second);
  // Run the result back through: the sentence must not be able to contain itself.
  assert.equal(unstatedOutcomeNote("durham-county", first), `${first}. ${NO_OUTCOME_STATED}`);
});
