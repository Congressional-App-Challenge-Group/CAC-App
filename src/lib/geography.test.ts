import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGeoIndex,
  extractAddressFromText,
  extractZipFromText,
  haversineMiles,
  hasCoordinates,
  matchDecisionGeography,
  normalizeAddress,
  parsePetitionNumber,
  pointInRing,
  pointInRings,
  polygonCentroid,
  projectMercator,
  ringArea,
  toPolygonRings,
  unprojectMercator,
} from "./geography";

test("parsePetitionNumber reads petition identifiers", () => {
  assert.equal(
    parsePetitionNumber("Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC"),
    "2025-011",
  );
  assert.equal(parsePetitionNumber("Rezoning Petition: 2026-123 by Tribute Companies Inc"), "2026-123");
});

test("parsePetitionNumber ignores year-number pairs outside petitions", () => {
  // Guards against contract/budget records being mistaken for rezoning cases.
  assert.equal(parsePetitionNumber("Contract 2025-001 award for janitorial services"), null);
  assert.equal(parsePetitionNumber("Budget Ordinance FY2025-2026"), null);
});

test("normalizeAddress expands abbreviations and drops city noise", () => {
  assert.equal(normalizeAddress("1234 N. Garrison Rd., Charlotte, NC"), "1234 north garrison road");
  assert.equal(normalizeAddress("900 E 4th St Suite 200"), "900 east 4th street");
});

test("extractAddressFromText finds a street address", () => {
  assert.equal(extractAddressFromText("Petition for property at 4820 Colonial Avenue today"), "4820 Colonial Avenue");
  assert.equal(extractAddressFromText("No address stated in this record"), null);
});

test("extractZipFromText only matches Charlotte-area ZIPs", () => {
  assert.equal(extractZipFromText("Affects residents in 28205 and nearby"), "28205");
  assert.equal(extractZipFromText("Reference 90210"), null);
});

test("matchDecisionGeography prefers an exact petition match", () => {
  const index = buildGeoIndex([
    {
      petitionNumber: "2025-011",
      address: "4820 Colonial Avenue",
      latitude: 35.2,
      longitude: -80.8,
      zipCode: "28205",
      councilDistrict: 5,
      sourceUrl: "https://example.gov/rezoning",
    },
  ]);
  const geography = matchDecisionGeography(
    {
      title: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
      summary: "Rezoning Petition: 2025-011",
      latestUpdate: "Under review as of 2026-09-01.",
    },
    index,
  );
  assert.equal(geography.confidence, "exact");
  assert.equal(geography.method, "petition-match");
  assert.equal(geography.zipCode, "28205");
  assert.equal(geography.councilDistrict, 5);
  assert.ok(hasCoordinates(geography));
});

test("matchDecisionGeography falls back to an address match", () => {
  const index = buildGeoIndex([
    {
      address: "4820 Colonial Ave",
      latitude: 35.2,
      longitude: -80.8,
      zipCode: "28205",
    },
  ]);
  const geography = matchDecisionGeography(
    { title: "Property at 4820 Colonial Avenue", summary: "", latestUpdate: "" },
    index,
  );
  assert.equal(geography.method, "address-match");
  assert.equal(geography.confidence, "exact");
});

test("matchDecisionGeography reports a ZIP stated in the record without inventing coordinates", () => {
  const index = buildGeoIndex([]);
  const geography = matchDecisionGeography(
    { title: "Neighbourhood improvement plan", summary: "Serving ZIP 28208", latestUpdate: "" },
    index,
  );
  assert.equal(geography.method, "record-text");
  assert.equal(geography.confidence, "likely");
  assert.equal(geography.zipCode, "28208");
  assert.equal(hasCoordinates(geography), false);
});

test("matchDecisionGeography stays unconfirmed when nothing supports a location", () => {
  const geography = matchDecisionGeography(
    { title: "Rezoning Petition: 2030-999 by Nobody LLC", summary: "", latestUpdate: "" },
    buildGeoIndex([]),
  );
  assert.equal(geography.method, "none");
  assert.equal(geography.confidence, "unconfirmed");
  assert.equal(geography.zipCode, undefined);
  assert.equal(geography.latitude, undefined);
});

test("haversineMiles measures a plausible distance", () => {
  const uptown = { latitude: 35.2271, longitude: -80.8431 };
  const concord = { latitude: 35.4088, longitude: -80.5795 };
  const miles = haversineMiles(uptown, concord);
  assert.ok(miles > 15 && miles < 25, `expected 15-25 miles, got ${miles}`);
});

test("mercator projection round-trips", () => {
  const { x, y } = projectMercator(35.2271, -80.8431, 13);
  const back = unprojectMercator(x, y, 13);
  assert.ok(Math.abs(back.latitude - 35.2271) < 1e-6);
  assert.ok(Math.abs(back.longitude + 80.8431) < 1e-6);
});

/* -------------------------------------------------------------------------- */
/* Polygon maths — datasets publish parcels as polygons, not points            */
/* -------------------------------------------------------------------------- */

// A 0.2 x 0.2 degree square near Charlotte, in [longitude, latitude] order.
const square: number[][] = [
  [-80.9, 35.1],
  [-80.7, 35.1],
  [-80.7, 35.3],
  [-80.9, 35.3],
  [-80.9, 35.1],
];

// A second, disjoint square, to exercise multi-polygon handling.
const square2: number[][] = [
  [-80.5, 35.1],
  [-80.4, 35.1],
  [-80.4, 35.2],
  [-80.5, 35.2],
  [-80.5, 35.1],
];

test("ringArea returns a signed area", () => {
  const area = Math.abs(ringArea(square));
  assert.ok(Math.abs(area - 0.04) < 1e-9, `expected 0.04, got ${area}`);
});

test("polygonCentroid centres on the polygon body", () => {
  const centroid = polygonCentroid([square]);
  assert.ok(centroid);
  assert.ok(Math.abs(centroid.longitude + 80.8) < 1e-9);
  assert.ok(Math.abs(centroid.latitude - 35.2) < 1e-9);
});

test("polygonCentroid ignores tiny slivers next to the main body", () => {
  const sliver: number[][] = [
    [-80.91, 35.29],
    [-80.899, 35.29],
    [-80.899, 35.291],
    [-80.91, 35.291],
  ];
  const centroid = polygonCentroid([sliver, square]);
  assert.ok(centroid);
  assert.ok(Math.abs(centroid.longitude + 80.8) < 1e-6);
});

test("pointInRing is a correct point-in-polygon test", () => {
  assert.equal(pointInRing({ latitude: 35.2, longitude: -80.8 }, square), true);
  assert.equal(pointInRing({ latitude: 35.5, longitude: -80.8 }, square), false);
  assert.equal(pointInRing({ latitude: 35.2, longitude: -80.0 }, square), false);
});

test("pointInRings handles multi-polygons", () => {
  const rings = [square, square2];
  assert.equal(pointInRings({ latitude: 35.2, longitude: -80.8 }, rings), true);
  assert.equal(pointInRings({ latitude: 35.15, longitude: -80.45 }, rings), true);
  assert.equal(pointInRings({ latitude: 35.25, longitude: -80.6 }, rings), false);
});

test("toPolygonRings normalizes ArcGIS rings and GeoJSON geometries", () => {
  assert.deepEqual(toPolygonRings({ rings: [square] }), [square]);
  assert.deepEqual(toPolygonRings({ type: "Polygon", coordinates: [square] }), [square]);
  assert.deepEqual(toPolygonRings({ type: "MultiPolygon", coordinates: [[square], [square2]] }), [
    square,
    square2,
  ]);
  assert.deepEqual(toPolygonRings(null), []);
});

test("matchDecisionGeography carries parcel acreage and the district representative", () => {
  const index = buildGeoIndex([
    {
      petitionNumber: "2025-011",
      address: "",
      latitude: 35.1849,
      longitude: -80.9776,
      zipCode: "28278",
      councilDistrict: 3,
      councilDistrictRep: "Sample Member",
      councilDistrictRepEmail: "member@example.gov",
      acres: 4.51,
      sourceUrl: "https://www.charlottenc.gov/example",
    },
  ]);

  const geography = matchDecisionGeography(
    {
      title: "Rezoning Petition: 2025-011 by Garrison Road Holdings, LLC",
      summary: "",
      latestUpdate: "",
    },
    index,
  );

  assert.equal(geography.acres, 4.51);
  assert.equal(geography.councilDistrict, 3);
  assert.equal(geography.councilDistrictRep, "Sample Member");
  assert.equal(geography.councilDistrictRepEmail, "member@example.gov");
  assert.equal(geography.confidence, "exact");
});
