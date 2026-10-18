import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decisionPlaceCodes,
  describePlace,
  governingBodies,
  matchesPlace,
  parseAddressInput,
  parsePlaceKey,
  placeCoverage,
  placeKey,
  placeMatch,
  resolvePlace,
  sameAddress,
  type PlaceBoundary,
  type PlaceDistrict,
} from "./place";
import type { DecisionGeography } from "@/types";

/* -------------------------------------------------------------------------- */
/* Fixtures — simple squares, so containment is unambiguous                    */
/* -------------------------------------------------------------------------- */

/** A square from (lat0, lng0) to (lat1, lng1), as `[lng, lat]` pairs. */
function square(lat0: number, lng0: number, lat1: number, lng1: number): number[][][] {
  return [
    [
      [lng0, lat0],
      [lng1, lat0],
      [lng1, lat1],
      [lng0, lat1],
      [lng0, lat0],
    ],
  ];
}

function boundary(
  kind: PlaceBoundary["kind"],
  code: string,
  label: string,
  box: number[][][],
  extra: Partial<PlaceBoundary> = {},
): PlaceBoundary {
  return { kind, code, label, rings: box, ...extra };
}

// A 0.1-degree-ish inner box for district 5, inside a county-wide outer box.
const BOUNDARIES: PlaceBoundary[] = [
  boundary("council", "5", "City Council District 5", square(35.2, -80.85, 35.24, -80.8), {
    rep: "Dante Anderson",
    email: "Dante.Anderson@charlottenc.gov",
  }),
  boundary("council", "3", "City Council District 3", square(35.24, -80.8, 35.28, -80.75)),
  boundary("county", "1", "County Commission District 1", square(35.15, -80.9, 35.3, -80.7), {
    rep: "Elaine Powell",
  }),
  boundary("school", "2", "CMS Board District 2", square(35.15, -80.9, 35.3, -80.75)),
  boundary("zip", "28205", "ZIP 28205", square(35.2, -80.85, 35.23, -80.81)),
  boundary("congress", "12", "Congressional District 12", square(35.0, -81.0, 35.5, -80.5)),
];

const IN_DISTRICT_5 = { latitude: 35.21, longitude: -80.84 };

const COUNCIL_5: PlaceDistrict = {
  kind: "council",
  code: "5",
  label: "City Council District 5",
};

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

test("a point resolves to every district that contains it", () => {
  const place = resolvePlace(IN_DISTRICT_5, BOUNDARIES);
  assert.deepEqual(
    place.map((district) => `${district.kind}:${district.code}`),
    ["council:5", "county:1", "school:2", "congress:12", "zip:28205"],
  );
});

test("districts are ordered by how often they decide a local matter", () => {
  const place = resolvePlace(IN_DISTRICT_5, BOUNDARIES);
  const kinds = place.map((district) => district.kind);
  assert.ok(kinds.indexOf("council") < kinds.indexOf("county"));
  assert.ok(kinds.indexOf("county") < kinds.indexOf("zip"));
});

test("a point outside every published boundary resolves to nothing, not to somewhere near", () => {
  // Outside the county entirely. Finding the nearest district would be a claim
  // the dataset cannot support, so the honest answer is an empty list.
  const place = resolvePlace({ latitude: 36.1, longitude: -81.0 }, BOUNDARIES);
  assert.deepEqual(place, []);
});

test("the representative comes back with the district", () => {
  const council = resolvePlace(IN_DISTRICT_5, BOUNDARIES).find(
    (district) => district.kind === "council",
  );
  assert.equal(council?.rep, "Dante Anderson");
  assert.equal(council?.email, "Dante.Anderson@charlottenc.gov");
});

test("overlapping polygons of the same kind still report exactly one district", () => {
  /*
   * Real boundary layers are supposed to tile without overlapping, but a reader
   * standing in a seam, a stale layer, or a generalised edge can all produce two
   * hits. Telling someone they are represented by two council members at once is
   * worse than telling them nothing, so one is chosen deterministically.
   */
  const overlapping = [
    ...BOUNDARIES,
    boundary("council", "9", "City Council District 9", square(35.2, -80.85, 35.24, -80.8)),
  ];
  const councils = resolvePlace(IN_DISTRICT_5, overlapping).filter(
    (district) => district.kind === "council",
  );
  assert.equal(councils.length, 1);
  assert.equal(councils[0].code, "5", "the lower code wins, so the answer is stable across runs");
});

test("a layer with no geometry is skipped rather than treated as universal", () => {
  const empty = [...BOUNDARIES, boundary("house", "100", "NC House District 100", [])];
  const place = resolvePlace(IN_DISTRICT_5, empty);
  assert.equal(place.some((district) => district.kind === "house"), false);
});

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

const locatedRecord = {
  geography: {
    councilDistrict: 5,
    countyDistrict: 1,
    zipCode: "28205",
    method: "petition-match",
    confidence: "exact",
  } satisfies DecisionGeography,
};

// Same city, different council district and a different ZIP: nothing here
// connects it to the reader's place, and it must not be shown as if it did.
const elsewhere = {
  geography: { councilDistrict: 3, zipCode: "28206", method: "petition-match", confidence: "exact" } satisfies DecisionGeography,
};

const unlocated = {
  geography: { method: "none", confidence: "unconfirmed" } satisfies DecisionGeography,
};

test("a decision in the reader's council district matches on the strongest shared district", () => {
  const match = placeMatch(locatedRecord, resolvePlace(IN_DISTRICT_5, BOUNDARIES));
  assert.equal(match?.district.kind, "council");
  assert.equal(match?.reason, "It is in your City Council District 5.");
});

test("a decision in a different district is not claimed as nearby", () => {
  assert.equal(placeMatch(elsewhere, resolvePlace(IN_DISTRICT_5, BOUNDARIES)), null);
  assert.equal(matchesPlace(elsewhere, COUNCIL_5), false);
});

test("a district match outranks a ZIP match on a record in both", () => {
  // `locatedRecord` is in council 5 *and* ZIP 28205. The stronger claim is the
  // one that names the body that votes.
  const both = {
    geography: {
      councilDistrict: 5,
      zipCode: "28205",
      method: "petition-match",
      confidence: "exact",
    } satisfies DecisionGeography,
  };
  assert.equal(placeMatch(both, resolvePlace(IN_DISTRICT_5, BOUNDARIES))?.district.kind, "council");
});

test("an unlocated record matches no place", () => {
  // This is the behaviour that keeps \"N decisions affect you\" honest: a record
  // nobody could place is never shown to a neighbourhood.
  assert.equal(placeMatch(unlocated, resolvePlace(IN_DISTRICT_5, BOUNDARIES)), null);
  assert.equal(matchesPlace(unlocated, COUNCIL_5), false);
});

test("a ZIP-only match is offered, but framed as weak", () => {
  const zipOnly = {
    geography: { zipCode: "28205", method: "record-text", confidence: "likely" } satisfies DecisionGeography,
  };
  const match = placeMatch(zipOnly, resolvePlace(IN_DISTRICT_5, BOUNDARIES));
  assert.equal(match?.district.kind, "zip");
  assert.match(match!.reason, /many neighbourhoods/);
});

test("a district-shaped record with no district resolved falls back to its ZIP", () => {
  const inZipOnly = {
    geography: { zipCode: "28205", method: "record-text", confidence: "likely" } satisfies DecisionGeography,
  };
  assert.equal(placeMatch(inZipOnly, resolvePlace(IN_DISTRICT_5, BOUNDARIES))?.weight, 20);
});

test("district codes are read off the record, so matching needs no polygons", () => {
  const codes = decisionPlaceCodes(locatedRecord.geography);
  assert.equal(codes.council, "5");
  assert.equal(codes.congress, undefined);
});

test("numbers and strings from different layers compare correctly", () => {
  // Council districts arrive as numbers and congressional ones as strings; the
  // comparison must not silently fail on the difference.
  const mixed = {
    geography: {
      congressionalDistrict: "12",
      method: "petition-match",
      confidence: "exact",
    } satisfies DecisionGeography,
  };
  assert.equal(matchesPlace(mixed, { kind: "congress", code: "12", label: "Congressional District 12" }), true);
});

/* -------------------------------------------------------------------------- */
/* Coverage                                                                    */
/* -------------------------------------------------------------------------- */

test("coverage always reports what could not be placed, beside what could", () => {
  const coverage = placeCoverage(
    [locatedRecord, elsewhere, unlocated, unlocated],
    resolvePlace(IN_DISTRICT_5, BOUNDARIES),
  );
  assert.equal(coverage.total, 4);
  assert.equal(coverage.matched, 1);
  assert.equal(coverage.located, 2);
  assert.equal(coverage.unlocated, 2);
});

/* -------------------------------------------------------------------------- */
/* Keys and prose                                                              */
/* -------------------------------------------------------------------------- */

test("a place key round-trips", () => {
  assert.deepEqual(parsePlaceKey(placeKey("council", "5")), { kind: "council", code: "5" });
  assert.deepEqual(parsePlaceKey("zip:28205"), {
    kind: "zip",
    code: "28205",
  });
  assert.equal(parsePlaceKey("nonsense"), null);
  assert.equal(parsePlaceKey("council:"), null);
  assert.equal(parsePlaceKey(":5"), null);
});

test("a place description names the districts and skips the ZIP", () => {
  const place = resolvePlace(IN_DISTRICT_5, BOUNDARIES);
  assert.equal(
    describePlace(place),
    "City Council District 5 · County Commission District 1 · CMS Board District 2 · Congressional District 12",
  );
});

test("the bodies that vote are named without inventing one for a ZIP", () => {
  const bodies = governingBodies(resolvePlace(IN_DISTRICT_5, BOUNDARIES));
  assert.deepEqual(bodies, [
    "Charlotte City Council",
    "Mecklenburg Board of County Commissioners",
    "CMS Board of Education",
    "U.S. House of Representatives",
  ]);
});

test("address comparison ignores the ways people write the same street", () => {
  assert.equal(sameAddress("4821 Express Dr", "4821 Express Drive"), true);
  assert.equal(sameAddress("8212 Douglas Dr, Charlotte, NC", "8212 Douglas Drive"), true);
  assert.equal(sameAddress("4821 Express Dr", "4823 Express Dr"), false);
});

/* -------------------------------------------------------------------------- */
/* Address input                                                               */
/* -------------------------------------------------------------------------- */

test("a typed address splits into the parts the county files it under", () => {
  assert.deepEqual(parseAddressInput("8212 Douglas Dr, Charlotte, NC 28217"), {
    number: 8212,
    streetName: "DOUGLAS",
    roadwayType: "DR",
    zipCode: "28217",
    direction: undefined,
  });
});

test("a spelled-out roadway type is matched to the abbreviation the county stores", () => {
  // A reader types "Drive"; the address file stores "DR". Getting this wrong
  // returns the wrong block, not just a worse match.
  assert.equal(parseAddressInput("13520 Hagers Ferry Road")?.roadwayType, "RD");
  assert.equal(parseAddressInput("1 Kings Grant Boulevard")?.roadwayType, "BLVD");
  assert.equal(parseAddressInput("77 Stinson Cove Avenue")?.roadwayType, "AVE");
});

test("a multi-word street name is kept whole", () => {
  const parsed = parseAddressInput("13520 Hagers Ferry Rd, Huntersville, NC");
  assert.equal(parsed?.streetName, "HAGERS FERRY");
  assert.equal(parsed?.zipCode, undefined);
});

test("a nine-digit ZIP is reduced to its five-digit part", () => {
  assert.equal(parseAddressInput("100 S Tryon St 28202-1234")?.zipCode, "28202");
});

test("a directional prefix is split off, because the county files it separately", () => {
  assert.deepEqual(parseAddressInput("100 N Tryon St"), {
    number: 100,
    streetName: "TRYON",
    direction: "N",
    roadwayType: "ST",
    zipCode: undefined,
  });
  assert.equal(parseAddressInput("400 South Tryon St")?.direction, "S");
  assert.equal(parseAddressInput("400 SW Tryon St")?.direction, "SW");
  assert.equal(parseAddressInput("400 Northeast Davidson St")?.direction, "NE");
});

test("a direction and a roadway type with no street name is not an address", () => {
  // "South Boulevard" names no location: South is the direction and Boulevard is
  // the roadway type. Returning a street name of "" would let the lookup search
  // for an empty name and match something arbitrary.
  assert.equal(parseAddressInput("400 South Boulevard"), null);
});

test("a street whose name merely starts with a direction word keeps it whole", () => {
  // "Northport" is a street name, not "port" with a north prefix. Splitting it
  // would search for a street that does not exist.
  const parsed = parseAddressInput("20135 Northport Dr");
  assert.equal(parsed?.streetName, "NORTHPORT");
  assert.equal(parsed?.direction, undefined);
});

test("a five-digit street number is a number, not a ZIP code", () => {
  // Real regression: the tokeniser stripped any five-digit run, so this address
  // arrived at the lookup with no number and asked the reader for one they had
  // just typed.
  const parsed = parseAddressInput("13520 Hagers Ferry Rd, Huntersville, NC 28078");
  assert.equal(parsed?.number, 13520);
  assert.equal(parsed?.streetName, "HAGERS FERRY");
  assert.equal(parsed?.zipCode, "28078");
});

test("a street with no number still parses, so it can be searched for", () => {
  const parsed = parseAddressInput("Douglas Drive");
  assert.equal(parsed?.number, undefined);
  assert.equal(parsed?.streetName, "DOUGLAS");
});

test("an entry with no street in it at all parses to nothing", () => {
  // "Charlotte, NC" is not an address, and resolving it to an arbitrary point in
  // the city would be a fabricated location.
  assert.equal(parseAddressInput(""), null);
  assert.equal(parseAddressInput("Charlotte, NC"), null);
  assert.equal(parseAddressInput("28217"), null);
  assert.equal(parseAddressInput("Drive"), null);
});
