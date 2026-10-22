import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseAddressInput,
  resolvePlace,
  type PlaceBoundary,
  type PlaceDistrict,
} from "@/lib/place";

/**
 * Place lookup.
 *
 * The rest of the product only needs the districts already stamped on each
 * record, which is why place matching works with no geometry at all. This module
 * exists for the one case that cannot: a reader typing *their own* address, which
 * has to be turned into a point before any district can be named.
 *
 * Two official sources, in order:
 *   1. the county's Master Address Points file for the geocode, and
 *   2. the generalised boundary layers bundled at build time for the districts.
 *
 * Nothing here guesses a location. If the address is not in the county's file,
 * the answer is "we could not find that address" — not the nearest match, and
 * never a point derived from the ZIP code alone.
 */

const COUNTY_GIS =
  process.env.PLACE_LAYER_BASE_URL ||
  "https://meckgis.mecklenburgcountync.gov/server/rest/services";

const ADDRESS_LAYER = `${COUNTY_GIS}/MasterAddressPoints/MapServer/0`;

type BoundaryArtifact = {
  generatedAt?: string;
  source?: string;
  generalizationDegrees?: number;
  boundaries?: PlaceBoundary[];
};

/** Read once per process: the artifact is ~1.4 MB and never changes at runtime. */
let boundaryCache: { boundaries: PlaceBoundary[]; source?: string; generatedAt?: string } | null =
  null;

export async function loadPlaceBoundaries(): Promise<{
  boundaries: PlaceBoundary[];
  source?: string;
  generatedAt?: string;
}> {
  if (boundaryCache) return boundaryCache;
  try {
    const raw = await readFile(resolve(process.cwd(), ".civiclens", "place-boundaries.json"), "utf8");
    const parsed = JSON.parse(raw) as BoundaryArtifact;
    boundaryCache = {
      boundaries: Array.isArray(parsed.boundaries) ? parsed.boundaries : [],
      source: parsed.source,
      generatedAt: parsed.generatedAt,
    };
  } catch {
    // Absent on a deployment whose build could not reach the county's GIS. The
    // lookup reports that plainly instead of returning an empty-but-confident
    // profile with no districts in it.
    boundaryCache = { boundaries: [] };
  }
  return boundaryCache;
}

type AddressRow = {
  full_address?: string;
  address?: string;
  cde_zip1?: string;
  nme_city?: string;
  nme_street?: string;
  cde_street_dir_prfx?: string | null;
  latitude?: number;
  longitude?: number;
};

type GeoPoint = { latitude: number; longitude: number; matchedAddress: string; zipCode?: string };

/** Single-quote escaping for an OData string literal. */
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * Find the county's own record of a typed address.
 *
 * Queries the structured columns the file is actually keyed on — street number,
 * street name, roadway type — rather than a full-text search, because a LIKE
 * over the whole address happily returns 8231 Douglas Dr for a request for 8212,
 * which would place a reader in the wrong district while looking correct.
 */
type GeocodeResult =
  | { kind: "found"; point: GeoPoint }
  | { kind: "missing" }
  | { kind: "ambiguous"; candidates: string[] };

async function geocodeAddress(input: string): Promise<GeocodeResult> {
  const parsed = parseAddressInput(input);
  if (!parsed || parsed.number === undefined) return { kind: "missing" };

  /*
   * Both storage conventions are tried in one query.
   *
   * The county keeps a directional prefix in `cde_street_dir_prfx` with the
   * street name stripped of it ("100 N TRYON ST" → name "TRYON", prefix "N"),
   * but a street whose name merely begins with a direction word stays whole
   * ("NORTHPORT DR" → name "NORTHPORT", no prefix). Asking for both spellings
   * matches either convention without this code having to know which one a given
   * street follows.
   */
  const spellings = parsed.direction
    ? [quote(parsed.streetName), quote(`${parsed.direction} ${parsed.streetName}`)]
    : [quote(parsed.streetName)];

  const clauses = [
    `txt_street_number = ${parsed.number}`,
    `(${spellings.map((name) => `nme_street = ${name}`).join(" OR ")})`,
  ];
  if (parsed.roadwayType) clauses.push(`repl_txt_roadway_abbrev = ${quote(parsed.roadwayType)}`);
  if (parsed.zipCode) clauses.push(`cde_zip1 = ${quote(parsed.zipCode)}`);

  const query = new URLSearchParams({
    where: clauses.join(" AND "),
    outFields:
      "full_address,address,cde_zip1,nme_city,nme_street,cde_street_dir_prfx,latitude,longitude",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "25",
  });

  const response = await fetch(`${ADDRESS_LAYER}/query?${query}`, {
    headers: { "user-agent": "CivicLens/1.0 place lookup" },
  });
  if (!response.ok) throw new Error(`${response.status} from the county address file`);

  const payload = (await response.json()) as {
    features?: Array<{ attributes?: AddressRow }>;
    error?: { message?: string };
  };
  if (payload.error) throw new Error(payload.error.message ?? "county address file error");

  const rows = (payload.features ?? [])
    .map((feature) => feature.attributes)
    .filter((row): row is AddressRow => Boolean(row))
    .filter((row) => typeof row.latitude === "number" && typeof row.longitude === "number");

  if (!rows.length) return { kind: "missing" };

  /*
   * A typed direction is honoured rather than ignored.
   *
   * "100 S Tryon St" is not the same address as "100 N Tryon St", and returning
   * the north one would place the reader in the wrong council district while
   * looking like a successful lookup. When they disagree, saying so is the only
   * correct answer.
   */
  if (parsed.direction) {
    const match = rows.find((row) => (row.cde_street_dir_prfx ?? "") === parsed.direction);
    if (!match) return { kind: "missing" };
    return { kind: "found", point: toPoint(match, parsed) };
  }

  // No direction typed: several streets can share a number and a name (100 N
  // Tryon and 100 S Tryon are different blocks), so the reader is asked rather
  // than assigned one at random.
  const prefixes = [...new Set(rows.map((row) => row.cde_street_dir_prfx).filter(Boolean))];
  if (prefixes.length > 1) {
    return {
      kind: "ambiguous",
      candidates: rows
        .map((row) => row.full_address || row.address)
        .filter((value): value is string => Boolean(value))
        .slice(0, 6),
    };
  }

  return { kind: "found", point: toPoint(rows[0], parsed) };
}

function toPoint(row: AddressRow, parsed: { number?: number; streetName: string }): GeoPoint {
  return {
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    matchedAddress: row.full_address || row.address || `${parsed.number} ${parsed.streetName}`,
    zipCode: row.cde_zip1,
  };
}

/* -------------------------------------------------------------------------- */
/* The lookup                                                                  */
/* -------------------------------------------------------------------------- */

export type PlaceLookup =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      matchedAddress: string;
      zipCode?: string;
      districts: PlaceDistrict[];
      /** The county's own record of the address. */
      sourceUrl: string;
      boundariesGeneratedAt?: string;
    }
  | {
      ok: false;
      reason: "unparsed" | "no-street-number" | "not-found" | "ambiguous" | "upstream-unavailable";
      message: string;
      /** What the county's file offered, when the entry matched more than one. */
      candidates?: string[];
    };

/**
 * Resolve a device position to a *district profile* by anchoring it to the
 * county's own address file — never by mapping the raw point directly.
 *
 * The typed-address flow deliberately refuses geolocation because where a
 * reader's phone currently sits is not where they vote or pay taxes. But a
 * reader who has confirmed they want device positioning still deserves the
 * same authoritative answer, so this returns the nearest recorded address to
 * the supplied point (bounded window, no pagination, exact structured query),
 * then runs it through the SAME resolvePlace()-based lookup as a typed
 * address. The matched line is shown to the reader with the coordinates that
 * produced it, so the anchoring is observable rather than magical.
 *
 * Coordinates are used for the one query and echoed in the response the
 * requester came from; they are not logged, stored, or sent to any other
 * service.
 */
export async function nearestPlace(
  rawLatitude: number,
  rawLongitude: number,
): Promise<PlaceLookup & { anchoredWithinMeters?: number }> {
  // Sanity-bounded Mecklenburg County window; everything outside it is "not in
  // the address file", which is the truthful answer rather than a far match.
  const inCounty =
    rawLatitude >= 34.9 && rawLatitude <= 35.6 && rawLongitude >= -81.2 && rawLongitude <= -80.5;
  if (!Number.isFinite(rawLatitude) || !Number.isFinite(rawLongitude) || !inCounty) {
    return {
      ok: false,
      reason: "not-found",
      message: "That position is outside Mecklenburg County, where CivicLens currently indexes records.",
    };
  }

  // Web Mercator metres around the point, converted to the county's EPSG:2264
  // foot grid only inside the query URL. The variance matches a city block.
  const metersPerFoot = 0.3048;
  const R = 6_378_137;
  const latRadius = (rawLatitude * Math.PI) / 180;
  const spanMetres = 250;
  const dLat = (spanMetres / R) * (180 / Math.PI);
  const dLon = (spanMetres / (R * Math.cos(latRadius))) * (180 / Math.PI);
  const south = rawLatitude - dLat;
  const west = rawLongitude - dLon;
  const north = rawLatitude + dLat;
  const east = rawLongitude + dLon;

  // EPSG:2264 (NC State Plane, US survey feet) approximate bounds derived from
  // the geographic envelope; the county query clips to real features anyway.
  const toFeet = (metres: number) => metres / metersPerFoot;
  const xMinimum = 1_400_000 + toFeet((west + 81.2) * 111_320 * Math.cos(35.2 * Math.PI / 180));
  const yMinimum = 700_000 + toFeet((south - 34.9) * 111_320);
  const xMaximum = 1_400_000 + toFeet((east + 81.2) * 111_320 * Math.cos(35.2 * Math.PI / 180));
  const yMaximum = 700_000 + toFeet((north - 34.9) * 111_320);

  const query = new URLSearchParams({
    geometry: JSON.stringify({
      xmin: xMinimum,
      ymin: yMinimum,
      xmax: xMaximum,
      ymax: yMaximum,
      spatialReference: { wkid: 2264 },
    }),
    geometryType: "esriGeometryEnvelope",
    inSR: "2264",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "full_address,address,cde_zip1,nme_city,nme_street,cde_street_dir_prfx,latitude,longitude",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "12",
  });

  let rows: AddressRow[];
  try {
    const response = await fetch(`${ADDRESS_LAYER}/query?${query}`, {
      headers: { "user-agent": "CivicLens/1.0 place lookup" },
    });
    if (!response.ok) throw new Error(`${response.status} from the county address file`);
    const payload = (await response.json()) as {
      features?: Array<{ attributes?: AddressRow }>;
      error?: { message?: string };
    };
    if (payload.error) throw new Error(payload.error.message ?? "county address file error");
    rows = (payload.features ?? [])
      .map((feature) => feature.attributes)
      .filter((row): row is AddressRow => Boolean(row))
      .filter((row) => typeof row.latitude === "number" && typeof row.longitude === "number");
  } catch (error) {
    return {
      ok: false,
      reason: "upstream-unavailable",
      message: `The county's address file could not be reached (${error instanceof Error ? error.message : "unknown error"}).`,
    };
  }

  if (!rows.length) {
    return {
      ok: false,
      reason: "not-found",
      message: "No county-record address sits near this position, so no districts can be resolved from it.",
    };
  }

  // Nearest recorded address by straight-line distance; the anchor is disclosed.
  const nearest = rows.reduce((best, row) => {
    const d = (row.latitude! - rawLatitude) ** 2 + (row.longitude! - rawLongitude) ** 2;
    const bestD = (best.latitude! - rawLatitude) ** 2 + (best.longitude! - rawLongitude) ** 2;
    return d < bestD ? row : best;
  });
  const anchorLat = nearest.latitude!;
  const anchorLon = nearest.longitude!;
  const meters = Math.abs(anchorLat - rawLatitude) * 111_320 + Math.abs(anchorLon - rawLongitude) * 111_320 * Math.cos((rawLatitude * Math.PI) / 180);

  const lookup = await lookupPlace(nearest.full_address || nearest.address || "");
  if (!lookup.ok) return lookup;
  return { ...lookup, anchoredWithinMeters: Math.round(meters) };
}

export async function lookupPlace(input: string): Promise<PlaceLookup> {
  const parsed = parseAddressInput(input);
  if (!parsed) {
    return {
      ok: false,
      reason: "unparsed",
      message: "That does not look like a street address. Include a street number and name.",
    };
  }
  if (parsed.number === undefined) {
    return {
      ok: false,
      reason: "no-street-number",
      message:
        "Add the street number. Without it there are dozens of candidates and picking one would be a guess.",
    };
  }

  let found: GeocodeResult;
  try {
    found = await geocodeAddress(input);
  } catch (error) {
    return {
      ok: false,
      reason: "upstream-unavailable",
      message: `The county's address file could not be reached (${
        error instanceof Error ? error.message : "unknown error"
      }).`,
    };
  }

  if (found.kind === "ambiguous") {
    return {
      ok: false,
      reason: "ambiguous",
      message: `More than one street matches. Add the direction, for example “${
        found.candidates[0] ?? "100 N Tryon St"
      }”.`,
      candidates: found.candidates,
    };
  }

  if (found.kind === "missing") {
    return {
      ok: false,
      reason: "not-found",
      message:
        "That address is not in the county's address file. Check the street number and direction, and try again.",
    };
  }

  const point = found.point;

  const { boundaries, generatedAt } = await loadPlaceBoundaries();

  return {
    ok: true,
    latitude: point.latitude,
    longitude: point.longitude,
    matchedAddress: point.matchedAddress,
    zipCode: point.zipCode,
    districts: resolvePlace({ latitude: point.latitude, longitude: point.longitude }, boundaries),
    sourceUrl: ADDRESS_LAYER,
    boundariesGeneratedAt: generatedAt,
  };
}

/**
 * Whether the boundary artifact is present.
 *
 * The interface needs this to tell a reader the difference between "your address
 * is outside every district" and "this deployment was built without district
 * geometry" — two very different situations that both produce an empty list.
 */
export async function placeBoundariesAvailable(): Promise<boolean> {
  const { boundaries } = await loadPlaceBoundaries();
  return boundaries.length > 0;
}
