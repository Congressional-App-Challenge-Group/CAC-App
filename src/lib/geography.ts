import type { Decision, DecisionGeography, GeoConfidence, GeoMethod } from "@/types";

/**
 * Geography spine.
 *
 * Every function here is pure so it can be unit tested and so the same matcher
 * runs in the ingestion job, in the enrichment script, and in tests.
 *
 * Guiding rule: a ZIP, district or coordinate is only ever asserted when it can
 * be traced back to a source (an official dataset row, or text in the record
 * itself). Anything else stays absent and surfaces as "location not confirmed".
 */

/** A row from an official geospatial dataset (e.g. Charlotte's Rezoning History). */
export type GeoRecord = {
  petitionNumber?: string;
  address: string;
  latitude: number;
  longitude: number;
  zipCode?: string;
  neighborhood?: string;
  parcelId?: string;
  sourceUrl?: string;
  acres?: number;
  /** Zoning stated by the official dataset. */
  existingZoning?: string;
  requestedZoning?: string;

  /* Districts, reverse-looked-up from the county's own boundary layers. */
  councilDistrict?: number;
  councilDistrictRep?: string;
  councilDistrictRepEmail?: string;
  countyDistrict?: number;
  countyDistrictRep?: string;
  countyDistrictRepEmail?: string;
  schoolBoardDistrict?: number;
  congressionalDistrict?: string;
  stateHouseDistrict?: string;
  stateSenateDistrict?: string;
};

/** `[ring][vertex][x, y]` — longitude/latitude pairs, outer rings first. */
export type PolygonRings = number[][][];

export type GeoIndex = {
  byPetition: Map<string, GeoRecord>;
  byAddress: Map<string, GeoRecord>;
};

const STREET_SUFFIXES =
  "street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|place|pl|parkway|pkwy|highway|hwy|way|circle|cir|terrace|ter|trail|trl|alley|aly|square|sq|crossing|xing";

const ADDRESS_PATTERN = new RegExp(
  `\\b(\\d{2,6})\\s+([A-Za-z0-9][A-Za-z0-9.'-]*(?:\\s+[A-Za-z0-9][A-Za-z0-9.'-]*){0,4}?)\\s+(${STREET_SUFFIXES})\\b\\.?`,
  "i",
);

const ABBREVIATIONS: Record<string, string> = {
  st: "street",
  ave: "avenue",
  rd: "road",
  blvd: "boulevard",
  dr: "drive",
  ln: "lane",
  ct: "court",
  pl: "place",
  pkwy: "parkway",
  hwy: "highway",
  cir: "circle",
  ter: "terrace",
  trl: "trail",
  aly: "alley",
  xing: "crossing",
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
};

/** Normalize a street address so dataset rows and record text can be compared. */
export function normalizeAddress(value: string): string {
  let text = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[.,#]/g, " ")
    .replace(/\b(?:suite|ste|unit|apt|apartment|floor|fl)\s*[\w-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .split(" ")
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(" ");

  // Drop the city/state tail if a dataset row includes it.
  text = text.replace(/\b(charlotte|mecklenburg|nc|north carolina)\b/g, " ").replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Rezoning petition identifiers look like "2025-011" or "2026-123".
 * Guarded on the word "petition" because contract and budget records also
 * contain year-number pairs that would otherwise match.
 */
export function parsePetitionNumber(title: string): string | null {
  if (!/petition|rezoning/i.test(title)) return null;
  const match = title.match(/\b(19|20)(\d{2})\s*[-–—]\s*(\d{1,4})\b/);
  if (!match) return null;
  const year = `${match[1]}${match[2]}`;
  const sequence = String(Number(match[3])).padStart(3, "0");
  return `${year}-${sequence}`;
}

/** Pull the first street address out of free text, if one is stated. */
export function extractAddressFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(ADDRESS_PATTERN);
  if (!match) return null;
  return `${match[1]} ${match[2]} ${match[3]}`.replace(/\s+/g, " ").trim();
}

/**
 * Charlotte-area ZIP codes are 280xx–282xx. Only what the record literally
 * states is returned, never an inferred value.
 */
export function extractZipFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(28[0-2]\d{2})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/* -------------------------------------------------------------------------- */
/* Polygon maths — used to place polygon datasets on a map and to reverse      */
/* look up which ZIP and council district contain a parcel.                    */
/* -------------------------------------------------------------------------- */

/** Signed area of a ring given as `[x, y]` pairs. */
export function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/**
 * Area centroid of the largest ring. Datasets describe parcels as polygons
 * rather than points, so this is what puts them on a map.
 */
export function polygonCentroid(
  rings: PolygonRings,
): { latitude: number; longitude: number } | null {
  let best: number[][] | null = null;
  let bestArea = 0;
  for (const ring of rings) {
    const area = Math.abs(ringArea(ring));
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  if (!best || bestArea === 0) return null;

  const ring = best;
  const area = ringArea(ring);
  if (area === 0) return null;

  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  return { longitude: cx / (6 * area), latitude: cy / (6 * area) };
}

/** Ray-casting test for a single ring. */
export function pointInRing(
  point: { latitude: number; longitude: number },
  ring: number[][],
): boolean {
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const straddles = yi > y !== yj > y;
    if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Even-odd test across every ring. This handles both multi-polygons (two
 * disjoint outer rings) and polygons with holes (an outer ring plus an inner
 * ring), which is how boundary datasets are published.
 */
export function pointInRings(
  point: { latitude: number; longitude: number },
  rings: PolygonRings,
): boolean {
  let inside = false;
  for (const ring of rings) if (pointInRing(point, ring)) inside = !inside;
  return inside;
}

/** Normalize an ArcGIS `rings` value or a GeoJSON geometry into `PolygonRings`. */
export function toPolygonRings(geometry: unknown): PolygonRings {
  const value = geometry as {
    rings?: number[][][];
    type?: string;
    coordinates?: unknown;
  } | null;
  if (!value) return [];
  if (Array.isArray(value.rings)) return value.rings;

  if (value.type === "Polygon" && Array.isArray(value.coordinates)) {
    return value.coordinates as PolygonRings;
  }
  if (value.type === "MultiPolygon" && Array.isArray(value.coordinates)) {
    return (value.coordinates as PolygonRings[]).flat();
  }
  return [];
}

export function buildGeoIndex(records: GeoRecord[]): GeoIndex {
  const byPetition = new Map<string, GeoRecord>();
  const byAddress = new Map<string, GeoRecord>();

  for (const record of records) {
    if (record.petitionNumber) {
      const key = parsePetitionNumber(`petition ${record.petitionNumber}`);
      if (key && !byPetition.has(key)) byPetition.set(key, record);
    }
    if (record.address) {
      const key = normalizeAddress(record.address);
      if (key && !byAddress.has(key)) byAddress.set(key, record);
    }
  }

  return { byPetition, byAddress };
}

function geographyFromRecord(
  record: GeoRecord,
  method: GeoMethod,
  confidence: GeoConfidence,
): DecisionGeography {
  return {
    address: record.address || undefined,
    latitude: record.latitude,
    longitude: record.longitude,
    zipCode: record.zipCode,
    neighborhood: record.neighborhood,
    parcelId: record.parcelId,
    sourceUrl: record.sourceUrl,
    acres: record.acres,
    councilDistrict: record.councilDistrict,
    councilDistrictRep: record.councilDistrictRep,
    councilDistrictRepEmail: record.councilDistrictRepEmail,
    countyDistrict: record.countyDistrict,
    countyDistrictRep: record.countyDistrictRep,
    countyDistrictRepEmail: record.countyDistrictRepEmail,
    schoolBoardDistrict: record.schoolBoardDistrict,
    congressionalDistrict: record.congressionalDistrict,
    stateHouseDistrict: record.stateHouseDistrict,
    stateSenateDistrict: record.stateSenateDistrict,
    method,
    confidence,
  };
}

/**
 * Resolve a decision's location in descending order of trust:
 *   1. petition number matched in the official dataset  (exact)
 *   2. street address matched in the official dataset   (exact)
 *   3. ZIP stated verbatim in the record text           (likely, no coordinates)
 *   4. partial ZIP or address fragment                 (likely, no coordinates)
 *   5. nothing                                          (unconfirmed)
 *
 * TODO: Improve address matching - current regex might miss some edge cases
 * NOTE: ZIP code matching is approximate - could be improved with better data
 */
export function matchDecisionGeography(
  decision: Pick<Decision, "title" | "summary" | "latestUpdate">,
  index: GeoIndex,
): DecisionGeography {
  const petition = parsePetitionNumber(decision.title);
  if (petition) {
    const record = index.byPetition.get(petition);
    if (record) return geographyFromRecord(record, "petition-match", "exact");
  }

  const haystacks = [decision.title, decision.summary, decision.latestUpdate].filter(Boolean);
  for (const haystack of haystacks) {
    const address = extractAddressFromText(haystack);
    if (!address) continue;
    const record = index.byAddress.get(normalizeAddress(address));
    if (record) return geographyFromRecord(record, "address-match", "exact");
  }

  // Datasets keyed only on an address are also matched directly.
  for (const haystack of haystacks) {
    const normalised = normalizeAddress(haystack);
    if (!normalised) continue;
    for (const [key, record] of index.byAddress) {
      if (key.length >= 8 && normalised.includes(key)) {
        return geographyFromRecord(record, "address-match", "likely");
      }
    }
  }

  // Extract ZIP codes from multiple locations
  for (const haystack of haystacks) {
    const zip = extractZipFromText(haystack);
    if (zip) {
      return {
        zipCode: zip,
        method: "record-text",
        confidence: "likely",
      };
    }
  }

  // Fallback: try to find any 5-digit pattern that looks like a Charlotte-area ZIP
  for (const haystack of haystacks) {
    const relaxedZipMatch = haystack.match(/\b(28\d{3})\b/);
    if (relaxedZipMatch) {
      return {
        zipCode: relaxedZipMatch[1],
        method: "record-text",
        confidence: "likely",
      };
    }
  }

  return { method: "none", confidence: "unconfirmed" };
}

export function hasCoordinates(geography?: DecisionGeography | null): boolean {
  return Boolean(
    geography &&
      typeof geography.latitude === "number" &&
      typeof geography.longitude === "number" &&
      Number.isFinite(geography.latitude) &&
      Number.isFinite(geography.longitude),
  );
}

/** Great-circle distance in miles — used to rank decisions against a ZIP. */
export function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const TILE_SIZE = 256;

/** Web Mercator projection to world pixel coordinates at a given zoom. */
export function projectMercator(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Inverse of projectMercator. */
export function unprojectMercator(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? "N" : "S";
  const ew = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(4)}°${ns}, ${Math.abs(longitude).toFixed(4)}°${ew}`;
}

export function confidenceLabel(confidence: GeoConfidence): string {
  switch (confidence) {
    case "exact":
      return "Matched to an official record";
    case "likely":
      return "Stated in the record";
    default:
      return "Location not confirmed";
  }
}

export function methodLabel(method: GeoMethod): string {
  switch (method) {
    case "petition-match":
      return "Petition number matched the city's rezoning dataset";
    case "address-match":
      return "Street address matched the city's rezoning dataset";
    case "record-text":
      return "ZIP code taken from the wording of the official record";
    case "manual":
      return "Set by an editor";
    default:
      return "No location source available";
  }
}
