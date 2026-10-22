import type { Decision, DecisionGeography } from "@/types";
import {
  normalizeAddress,
  pointInRings,
  type PolygonRings,
} from "./geography";

/**
 * The place spine.
 *
 * The geography spine answers "where is this decision". This answers the
 * question a resident actually starts from: *which of my representatives is
 * deciding the things near me?*
 *
 * Everything here is pure, so the same resolution runs in the enrichment job,
 * behind the address lookup, and in tests — and the interface never has to
 * invent an answer.
 *
 * Two rules carry over from the geography spine:
 *
 *   - A district is only ever claimed when the point falls inside a polygon
 *     published by the county. No inference from a ZIP code.
 *   - Absence is stated, not filled. A record with no coordinates belongs to no
 *     district, and the interface says so instead of placing it in the nearest
 *     one. That is why 71% of the record set honestly reads "location not
 *     confirmed" rather than being silently assigned to a council member.
 */

/* -------------------------------------------------------------------------- */
/* Kinds                                                                       */
/* -------------------------------------------------------------------------- */

export const placeKinds = [
  "council",
  "county",
  "school",
  "zip",
  "congress",
  "house",
  "senate",
] as const;
export type PlaceKind = (typeof placeKinds)[number];

/**
 * What each kind of district is, in the words the interface uses.
 *
 * `body` names the institution that votes, which is what Phase 2's action layer
 * needs: a resident who wants to speak to the decision has to speak to the body
 * that decides it, not to \"the government\".
 */
export const placeKindMeta: Record<
  PlaceKind,
  { name: string; body: string; governs: string; weight: number }
> = {
  council: {
    name: "City Council district",
    body: "Charlotte City Council",
    governs: "Rezoning, streets, city services and the city budget",
    weight: 100,
  },
  county: {
    name: "County commission district",
    body: "Mecklenburg Board of County Commissioners",
    governs: "County taxes, health, parks and the county budget",
    weight: 90,
  },
  school: {
    name: "School board district",
    body: "CMS Board of Education (not currently ingested - data source pending)",
    governs: "School boundaries, student assignment and the school budget",
    weight: 80,
  },
  zip: {
    name: "ZIP code",
    body: "Several bodies share this area",
    governs: "Used to group decisions, not to identify a single decision-maker",
    weight: 20,
  },
  congress: {
    name: "Congressional district",
    body: "U.S. House of Representatives",
    governs: "Federal matters",
    weight: 60,
  },
  house: {
    name: "NC House district",
    body: "North Carolina House of Representatives",
    governs: "State law",
    weight: 50,
  },
  senate: {
    name: "NC Senate district",
    body: "North Carolina Senate",
    governs: "State law",
    weight: 40,
  },
};

/** One district a point falls inside, as published by the county. */
export type PlaceDistrict = {
  kind: PlaceKind;
  code: string;
  label: string;
  rep?: string;
  email?: string;
  sourceUrl?: string;
};

/** A boundary layer, ready for point-in-polygon testing. */
export type PlaceBoundary = {
  kind: PlaceKind;
  code: string;
  label: string;
  rep?: string;
  email?: string;
  sourceUrl?: string;
  rings: PolygonRings;
};

/** A resolved address: a point, plus every district that contains it. */
export type PlaceProfile = {
  latitude: number;
  longitude: number;
  /** What the resident's own address is, as the county's address file spells it. */
  matchedAddress: string;
  zipCode?: string;
  districts: PlaceDistrict[];
};

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

/** The label the interface prints for a district. Declared once, used everywhere. */
export function placeLabel(kind: PlaceKind, code: string): string {
  switch (kind) {
    case "council":
      return `City Council District ${code}`;
    case "county":
      return `County Commission District ${code}`;
    case "school":
      return `CMS Board District ${code}`;
    case "zip":
      return `ZIP ${code}`;
    case "congress":
      return `Congressional District ${code}`;
    case "house":
      return `NC House District ${code}`;
    case "senate":
      return `NC Senate District ${code}`;
  }
}

export type Bounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

/** The bounding box of a ring set — a cheap rejection test before the real one. */
export function boundsOfRings(rings: PolygonRings): Bounds | null {
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;

  for (const ring of rings) {
    for (const vertex of ring) {
      const [longitude, latitude] = vertex;
      if (longitude < minLongitude) minLongitude = longitude;
      if (longitude > maxLongitude) maxLongitude = longitude;
      if (latitude < minLatitude) minLatitude = latitude;
      if (latitude > maxLatitude) maxLatitude = latitude;
    }
  }

  if (!Number.isFinite(minLatitude) || !Number.isFinite(minLongitude)) return null;
  return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

/**
 * Bounding boxes are cached per ring set.
 *
 * The enrichment job tests every official parcel against every district polygon,
 * which is 7,690 × ~120 tests. Walking each polygon's full vertex list that many
 * times took minutes; the box check rejects almost all of them in four
 * comparisons, and the cache keeps it from recomputing boxes per point.
 */
const boundsCache = new WeakMap<PolygonRings, Bounds | null>();

function cachedBounds(rings: PolygonRings): Bounds | null {
  const cached = boundsCache.get(rings);
  if (cached !== undefined) return cached;
  const computed = boundsOfRings(rings);
  boundsCache.set(rings, computed);
  return computed;
}

function contains(
  point: { latitude: number; longitude: number },
  rings: PolygonRings,
): boolean {
  const bounds = cachedBounds(rings);
  if (!bounds) return false;
  if (point.latitude < bounds.minLatitude || point.latitude > bounds.maxLatitude) return false;
  if (point.longitude < bounds.minLongitude || point.longitude > bounds.maxLongitude) return false;
  return pointInRings(point, rings);
}

/**
 * Which districts contain a point.
 *
 * Ordered by weight, so the body that most often decides a local matter is
 * listed first. A point outside every published boundary returns an empty list
 * rather than a nearest guess — the county's layers stop at the county line, and
 * a reader outside it should be told that plainly.
 */
export function resolvePlace(
  point: { latitude: number; longitude: number },
  boundaries: PlaceBoundary[],
): PlaceDistrict[] {
  const found: PlaceDistrict[] = [];

  for (const boundary of boundaries) {
    if (!boundary.rings.length) continue;
    if (!contains(point, boundary.rings)) continue;
    found.push({
      kind: boundary.kind,
      code: boundary.code,
      label: boundary.label,
      rep: boundary.rep,
      email: boundary.email,
      sourceUrl: boundary.sourceUrl,
    });
  }

  // One district per kind: a point can sit on a shared edge, and reporting two
  // council districts at once would be worse than reporting neither.
  const byKind = new Map<PlaceKind, PlaceDistrict>();
  for (const district of found) {
    const existing = byKind.get(district.kind);
    if (!existing || (district.code || "").localeCompare(existing.code || "") < 0) {
      byKind.set(district.kind, district);
    }
  }

  return [...byKind.values()].sort(
    (a, b) => placeKindMeta[b.kind].weight - placeKindMeta[a.kind].weight,
  );
}

/* -------------------------------------------------------------------------- */
/* Keys — a place as a bookmarkable, shareable thing                           */
/* -------------------------------------------------------------------------- */

/** `council:5`, `county:1`, `school:3`, `zip:28205`. */
export function placeKey(kind: PlaceKind, code: string): string {
  return `${kind}:${code}`;
}

export function parsePlaceKey(key: string): { kind: PlaceKind; code: string } | null {
  const index = key.indexOf(":");
  if (index < 1) return null;
  const kind = key.slice(0, index) as PlaceKind;
  const code = key.slice(index + 1);
  if (!code || !(placeKinds as readonly string[]).includes(kind)) return null;
  return { kind, code };
}

/**
 * The districts a decision sits in, taken from its own resolved geography.
 *
 * Read straight off the record rather than re-tested against polygons, which is
 * what makes place matching work in the static deployment: the boundary file is
 * only needed when a *resident's* address has to be resolved, never when a
 * decision is being matched to a place.
 */
export function decisionPlaceCodes(
  geography?: DecisionGeography | null,
): Partial<Record<PlaceKind, string>> {
  if (!geography) return {};
  const codes: Partial<Record<PlaceKind, string>> = {};
  if (geography.councilDistrict !== undefined) codes.council = String(geography.councilDistrict);
  if (geography.countyDistrict !== undefined) codes.county = String(geography.countyDistrict);
  if (geography.schoolBoardDistrict !== undefined) {
    codes.school = String(geography.schoolBoardDistrict);
  }
  if (geography.zipCode) codes.zip = geography.zipCode;
  if (geography.congressionalDistrict) codes.congress = geography.congressionalDistrict;
  if (geography.stateHouseDistrict) codes.house = geography.stateHouseDistrict;
  if (geography.stateSenateDistrict) codes.senate = geography.stateSenateDistrict;
  return codes;
}

/**
 * Does a decision sit in a place?
 *
 * Only districts the record actually resolved are compared. An unlocated record
 * therefore matches no place, which is the honest outcome: the alternative is
 * putting a decision in front of a neighbourhood that has nothing to do with it.
 */
export function matchesPlace(
  decision: Pick<Decision, "geography">,
  place: PlaceDistrict,
): boolean {
  const codes = decisionPlaceCodes(decision.geography);
  return codes[place.kind] === place.code;
}

export type PlaceMatch = {
  district: PlaceDistrict;
  /** Why this decision is being shown, in the reader's own terms. */
  reason: string;
  /** Higher is a tighter match. */
  weight: number;
};

/**
 * The strongest reason a decision belongs to a place, or null.
 *
 * A rezoning in the reader's council district is a different claim from a budget
 * item in the same ZIP code, so the reason names the district that matched
 * rather than saying "near you" — the reader can check it.
 */
export function placeMatch(
  decision: Pick<Decision, "geography">,
  place: PlaceDistrict[],
): PlaceMatch | null {
  for (const district of place) {
    if (district.kind === "zip") continue;
    if (!matchesPlace(decision, district)) continue;
    return {
      district,
      reason: `It is in your ${district.label}.`,
      weight: placeKindMeta[district.kind].weight,
    };
  }

  // A ZIP match is real but weak, so it is only offered when no district matched.
  const zip = place.find((district) => district.kind === "zip");
  if (zip && matchesPlace(decision, zip)) {
    return {
      district: zip,
      reason: `It is reported in ZIP ${zip.code}, which contains many neighbourhoods.`,
      weight: placeKindMeta.zip.weight,
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Writing a place back onto a record                                            */
/* -------------------------------------------------------------------------- */

/**
 * Copy the districts a point sits in onto that record's geography.
 *
 * Kept here rather than in the enrichment script so the mapping from a district
 * kind to a stored field has exactly one definition — the same reason the
 * district list is declared once. A kind with no field to write to is ignored
 * rather than stored loosely.
 */
export type PlaceFields = Pick<
  DecisionGeography,
  | "zipCode"
  | "councilDistrict"
  | "councilDistrictRep"
  | "councilDistrictRepEmail"
  | "countyDistrict"
  | "countyDistrictRep"
  | "countyDistrictRepEmail"
  | "schoolBoardDistrict"
  | "congressionalDistrict"
  | "stateHouseDistrict"
  | "stateSenateDistrict"
>;

/**
 * The stored fields a resolved place implies.
 *
 * This is the single definition of the district-kind-to-field mapping. Asking
 * each caller to remember that the county's `cc` column is `countyDistrict` and
 * that a school board district is *not* the same as an elementary attendance
 * zone is how a dataset quietly fills up with the wrong number in the right
 * column.
 */
export function placeFields(place: PlaceDistrict[]): PlaceFields {
  const fields: PlaceFields = {};

  for (const district of place) {
    const numeric = Number(district.code);
    switch (district.kind) {
      case "council":
        if (Number.isFinite(numeric)) fields.councilDistrict = numeric;
        if (district.rep) fields.councilDistrictRep = district.rep;
        if (district.email) fields.councilDistrictRepEmail = district.email;
        break;
      case "county":
        if (Number.isFinite(numeric)) fields.countyDistrict = numeric;
        if (district.rep) fields.countyDistrictRep = district.rep;
        if (district.email) fields.countyDistrictRepEmail = district.email;
        break;
      case "school":
        if (Number.isFinite(numeric)) fields.schoolBoardDistrict = numeric;
        break;
      case "zip":
        fields.zipCode = district.code;
        break;
      case "congress":
        fields.congressionalDistrict = district.code;
        break;
      case "house":
        fields.stateHouseDistrict = district.code;
        break;
      case "senate":
        fields.stateSenateDistrict = district.code;
        break;
    }
  }

  return fields;
}

/**
 * Copy the districts a point sits in onto a record's geography.
 *
 * A ZIP already stated by the official record is left alone: the boundary layer
 * is a fallback for a missing ZIP, not a correction of a published one.
 */
export function applyPlaceToGeography(
  geography: DecisionGeography,
  place: PlaceDistrict[],
): DecisionGeography {
  const fields = placeFields(place);
  const next: DecisionGeography = { ...geography };

  for (const [key, value] of Object.entries(fields) as Array<[keyof PlaceFields, string | number | undefined]>) {
    if (value === undefined) continue;
    if (key === "zipCode" && next.zipCode) continue;
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}

/* -------------------------------------------------------------------------- */
/* Address input                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How the county's address file abbreviates each roadway type.
 *
 * A reader types "Drive"; the file stores `DR`. Matching one against the other
 * is the whole job of this table, and it is why the lookup can use the county's
 * own structured columns instead of a text search that returns the wrong block.
 */
const ROADWAY_TYPES: Record<string, string> = {
  street: "ST", st: "ST", drive: "DR", dr: "DR", road: "RD", rd: "RD",
  avenue: "AVE", ave: "AVE", boulevard: "BLVD", blvd: "BLVD", lane: "LN", ln: "LN",
  court: "CT", ct: "CT", place: "PL", pl: "PL", parkway: "PKWY", pkwy: "PKWY",
  highway: "HWY", hwy: "HWY", way: "WAY", circle: "CIR", cir: "CIR",
  terrace: "TER", ter: "TER", trail: "TRL", trl: "TRL", square: "SQ", sq: "SQ",
  alley: "ALY", aly: "ALY", crossing: "XING", xing: "XING",
};

/**
 * Directional prefixes, in the abbreviated form the county stores.
 *
 * A word is only a direction when it stands alone. "Northport" and
 * "Northridge" begin with one but name a street outright, and treating them as
 * directions would send the lookup after a street that does not exist.
 */
const DIRECTIONS: Record<string, string> = {
  n: "N",
  north: "N",
  s: "S",
  south: "S",
  e: "E",
  east: "E",
  w: "W",
  west: "W",
  ne: "NE",
  northeast: "NE",
  nw: "NW",
  northwest: "NW",
  se: "SE",
  southeast: "SE",
  sw: "SW",
  southwest: "SW",
};

export type AddressInput = {
  /** Street number, when the reader typed one. */
  number?: number;
  /**
   * Street name without the directional prefix — "TRYON", not "N TRYON".
   *
   * The county files the direction in its own column, so leaving it attached
   * here would search for a street name that does not exist and report a real
   * address as not found.
   */
  streetName: string;
  /** Directional prefix, when the reader typed one. */
  direction?: string;
  /** Abbreviated roadway type, when one was recognisable. */
  roadwayType?: string;
  zipCode?: string;
};

/**
 * Read a typed address into the parts the county's own address file is keyed on.
 *
 * Returns null rather than a partial guess when there is nothing street-shaped
 * to look up, so an empty or nonsense entry reports "we could not find that"
 * instead of resolving to whatever happened to match one fragment.
 */
export function parseAddressInput(input: string): AddressInput | null {
  const cleaned = (input || "")
    .toUpperCase()
    .replace(/[.#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  /*
   * A ZIP is only ever read from the *end* of the entry.
   *
   * Matching a bare five-digit run anywhere in the string turned the street
   * number of "13520 Hagers Ferry Rd" into ZIP 13520, which does not exist — so
   * a real address failed to resolve while appearing to have been understood.
   */
  const zipMatch = cleaned.match(/(?:^|\s)(\d{5})(?:-\d{4})?$/);
  const zipCode = zipMatch?.[1];

  /*
   * Everything from the first comma onward is city, state and ZIP, so the street
   * is whatever precedes it. Without this, "…Hagers Ferry Rd, Huntersville, NC"
   * left the city name welded to the street name — and a street name that does
   * not match the county's file returns no address at all rather than a wrong
   * one, which just looks like a broken search to the reader.
   */
  let streetPart = cleaned.split(",")[0].trim();

  /*
   * Only the ZIP that was actually found at the end is removed, and only when it
   * falls inside the first segment (the comma-less form). Stripping every
   * five-digit run instead ate the street number of "13520 Hagers Ferry Rd" and
   * left the lookup asking the reader for a number they had already typed.
   */
  if (zipMatch) streetPart = streetPart.replace(/\s\d{5}(?:-\d{4})?$/, "").trim();

  const tokens = streetPart.split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let number: number | undefined;
  if (/^\d{1,6}$/.test(tokens[0])) {
    number = Number(tokens[0]);
    tokens.shift();
  }
  if (!tokens.length) return null;

  // Only a *leading* word can be a direction, and only when it stands alone.
  let direction: string | undefined;
  const first = DIRECTIONS[tokens[0].toLowerCase()];
  if (first && tokens.length > 1) {
    direction = first;
    tokens.shift();
  }

  /*
   * The roadway type marks the end of the street name, because the county keeps
   * the name on its own ("HAGERS FERRY") and the type in a separate column
   * ("RD"). Finding it also handles the comma-less form a reader often types —
   * "13520 Hagers Ferry Rd Huntersville NC" — since everything past the type is
   * city and state, not street.
   */
  const typeIndex = tokens.findIndex((token) => ROADWAY_TYPES[token.toLowerCase()]);
  // At index 0 the entry is a roadway type with no street name in front of it
  // ("Drive"), which names no location at all.
  if (typeIndex > 0) {
    const name = tokens.slice(0, typeIndex);
    return {
      number,
      streetName: name.join(" "),
      direction,
      roadwayType: ROADWAY_TYPES[tokens[typeIndex].toLowerCase()],
      zipCode,
    };
  }

  // No recognisable roadway type: drop the city and state words instead.
  const name = tokens.filter(
    (token) =>
      !/^(CHARLOTTE|MECKLENBURG|HUNTERSVILLE|CORNELIUS|DAVIDSON|MATTHEWS|MINT HILL|PINEVILLE|STALLINGS|WEDDINGTON|NORTH|CAROLINA|USA|UNITED|STATES)$/.test(
        token,
      ),
  );
  // Nothing but a roadway type is left, which is not an address.
  if (!name.length || name.every((token) => ROADWAY_TYPES[token.toLowerCase()])) return null;

  return { number, streetName: name.join(" "), direction, zipCode };
}

/* -------------------------------------------------------------------------- */
/* Prose                                                                       */
/* -------------------------------------------------------------------------- */

/** A one-line description of a place, for a heading. */
export function describePlace(place: PlaceDistrict[]): string {
  const named = place.filter((district) => district.kind !== "zip");
  if (!named.length) {
    const zip = place.find((district) => district.kind === "zip");
    return zip ? `ZIP ${zip.code}` : "No district resolved";
  }
  return named.map((district) => district.label).join(" · ");
}

/** The bodies that vote on matters in this place, deduplicated. */
export function governingBodies(place: PlaceDistrict[]): string[] {
  const seen = new Set<string>();
  for (const district of place) {
    if (district.kind === "zip") continue;
    seen.add(placeKindMeta[district.kind].body);
  }
  return [...seen];
}

/**
 * How much of the record set this place can actually see.
 *
 * The single most misleading number this product could print is \"N decisions
 * affect you\", because a decision with no resolved location cannot be shown to
 * affect anyone. So the count is always returned beside what could not be
 * placed, and the interface reports both.
 */
export function placeCoverage(
  decisions: Array<Pick<Decision, "geography">>,
  place: PlaceDistrict[],
): { matched: number; located: number; total: number; unlocated: number } {
  let matched = 0;
  let located = 0;
  for (const decision of decisions) {
    const codes = decisionPlaceCodes(decision.geography);
    if (Object.keys(codes).length) located += 1;
    if (placeMatch(decision, place)) matched += 1;
  }
  return { matched, located, total: decisions.length, unlocated: decisions.length - located };
}

/**
 * Compare two addresses for equality, the way the county's address file spells
 * them. Exported from here rather than geography.ts because normalising an
 * address is a *place* concern: it exists so a reader's typing can be compared
 * against an official row.
 */
export const sameAddress = (a: string, b: string): boolean =>
  normalizeAddress(a) === normalizeAddress(b);
