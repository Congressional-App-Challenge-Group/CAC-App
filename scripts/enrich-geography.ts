import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildGeoIndex,
  matchDecisionGeography,
  parsePetitionNumber,
  pointInRings,
  polygonCentroid,
  toPolygonRings,
  type GeoRecord,
  type PolygonRings,
} from "../src/lib/geography";
import { numberOrUndefined, pick, readJson, report, serviceClient, writeJson, type Dict } from "./shared";

/**
 * Geography spine.
 *
 * Places each tracked decision in the real world by matching it against the
 * City of Charlotte's published geospatial layers, then reverse-looking-up which
 * ZIP code and council district contain the parcel.
 *
 * Nothing is guessed. A record with no match keeps `method: "none"` and is
 * shown to readers as "location not confirmed".
 */

const DEFAULT_REZONING_LAYERS = [
  "https://gis.charlottenc.gov/arcgis/rest/services/PLN/Rezonings/MapServer/0",
  "https://gis.charlottenc.gov/arcgis/rest/services/PLN/RezoningHistory/MapServer/0",
];

const DEFAULT_ZIP_LAYER =
  "https://meckgis.mecklenburgcountync.gov/server/rest/services/ZipCodeBoundaries/FeatureServer/0";

const DEFAULT_DISTRICT_LAYER =
  "https://gis.charlottenc.gov/arcgis/rest/services/PLN/CouncilDistricts/MapServer/0";

const GEO_FILES = [".civiclens/geography-source.json", ".civiclens/rezoning-history.json"];

/** Query an ArcGIS layer, following pagination. */
async function queryLayer(
  url: string,
  params: Record<string, string>,
): Promise<Dict[]> {
  const collected: Dict[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < 60_000; offset += pageSize) {
    const query = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      ...params,
    });
    const response = await fetch(`${url.replace(/\/+$/, "")}/query?${query}`, {
      headers: { "user-agent": "CivicLens/1.0 geography enrichment" },
    });
    if (!response.ok) throw new Error(`${response.status} from ${url}`);
    const payload = (await response.json()) as {
      features?: Dict[];
      error?: { message?: string };
      exceededTransferLimit?: boolean;
    };
    if (payload.error) throw new Error(payload.error.message ?? "ArcGIS error");
    const features = payload.features ?? [];
    collected.push(...features);
    if (features.length < pageSize && !payload.exceededTransferLimit) break;
  }

  return collected;
}

/** Turn ArcGIS rezoning features into comparable geo records. */
function toGeoRecords(features: Dict[], sourceUrl: string): GeoRecord[] {
  const records: GeoRecord[] = [];

  for (const feature of features) {
    const attributes = (feature.attributes as Dict | undefined) ?? feature;
    const geometry = feature.geometry as Dict | undefined;
    const centroid = feature.centroid as { x?: number; y?: number } | undefined;

    const latitude =
      numberOrUndefined(centroid?.y) ??
      numberOrUndefined(pick(attributes, /^lat/i)) ??
      polygonCentroid(toPolygonRings(geometry))?.latitude;
    const longitude =
      numberOrUndefined(centroid?.x) ??
      numberOrUndefined(pick(attributes, /^lon/i)) ??
      polygonCentroid(toPolygonRings(geometry))?.longitude;

    const petition = pick(attributes, /^petition$/i, /petition.*(no|num|id)/i);
    if (latitude === undefined || longitude === undefined || typeof petition !== "string") continue;

    const existingZoning = pick(attributes, /^exist.*zone/i, /^existingzoning$/i);
    const requestedZoning = pick(attributes, /^req.*zone/i, /^requestedzoning$/i);
    const acreage = numberOrUndefined(pick(attributes, /^petacres$/i, /^acres$/i));
    const hyperlink = pick(attributes, /^hyperlink$/i, /^url$/i, /document/i);

    records.push({
      petitionNumber: petition,
      address: "",
      latitude,
      longitude,
      councilDistrict: numberOrUndefined(pick(attributes, /^district$/i, /council.*district/i)),
      neighborhood: (pick(attributes, /neighborhood/i, /^community$/i) as string) || undefined,
      sourceUrl: typeof hyperlink === "string" && /^https?:/i.test(hyperlink) ? hyperlink : sourceUrl,
      acres: acreage,
      existingZoning: typeof existingZoning === "string" ? existingZoning : undefined,
      requestedZoning: typeof requestedZoning === "string" ? requestedZoning : undefined,
    });
  }

  return records;
}

type Boundary = { rings: PolygonRings; label?: string; rep?: string; email?: string };

async function loadBoundaries(url: string): Promise<Boundary[]> {
  const features = await queryLayer(url, { returnCentroid: "false" });
  const boundaries: Boundary[] = [];

  for (const feature of features) {
    const attributes = (feature.attributes as Dict | undefined) ?? feature;
    const rings = toPolygonRings(feature.geometry);
    if (!rings.length) continue;

    const label = pick(attributes, /^zip$/i, /^district$/i, /^name$/i);
    const rep = pick(attributes, /rep(name)?$/i, /^districtrep$/i, /council.*member/i);
    const email = pick(attributes, /email/i);

    boundaries.push({
      rings,
      label: typeof label === "string" ? label : undefined,
      rep: typeof rep === "string" ? rep : undefined,
      email: typeof email === "string" ? email : undefined,
    });
  }

  return boundaries;
}

/** Resolve which boundary contains a point. */
function locate(
  boundaries: Boundary[],
  point: { latitude: number; longitude: number },
): Boundary | null {
  for (const boundary of boundaries) {
    if (pointInRings(point, boundary.rings)) return boundary;
  }
  return null;
}

async function loadBoundariesSafely(url: string, label: string, notes: string[]) {
  try {
    const boundaries = await loadBoundaries(url);
    notes.push(`${label}: ${boundaries.length} boundary polygons loaded.`);
    return boundaries;
  } catch (error) {
    notes.push(`${label}: unavailable (${error instanceof Error ? error.message : "unknown"}).`);
    return [];
  }
}

async function loadLocalGeoRecords(): Promise<GeoRecord[] | null> {
  for (const file of GEO_FILES) {
    try {
      const parsed: unknown = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8"));
      const features: Dict[] = Array.isArray(parsed)
        ? (parsed as Dict[])
        : Array.isArray((parsed as { features?: unknown }).features)
          ? ((parsed as { features: Dict[] }).features)
          : [];
      const records = toGeoRecords(features, file);
      if (records.length) return records;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function main() {
  const decisions = await readJson<
    Array<Dict & { id: string; title: string; summary: string; latestUpdate: string }>
  >("local-decisions.json");

  if (!decisions?.length) {
    report("Geography enrichment", ["No .civiclens/local-decisions.json found — run `pnpm ingest:local` first."]);
    return;
  }

  const notes: string[] = [];
  const layerUrls = process.env.CHARLOTTE_REZONING_LAYER_URL
    ? process.env.CHARLOTTE_REZONING_LAYER_URL.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_REZONING_LAYERS;

  const records: GeoRecord[] = [];
  for (const url of layerUrls) {
    try {
      const features = await queryLayer(url, { returnCentroid: "true" });
      const mapped = toGeoRecords(features, url);
      records.push(...mapped);
      notes.push(`Rezoning layer ${url.split("/services/")[1] ?? url}: ${mapped.length} parcels.`);
    } catch (error) {
      notes.push(
        `Rezoning layer ${url} failed: ${error instanceof Error ? error.message : "unknown"}.`,
      );
    }
  }

  // A local export is only consulted when the live layers produced nothing.
  if (!records.length) {
    const local = await loadLocalGeoRecords();
    if (local?.length) {
      records.push(...local);
      notes.push(`Used local geography export: ${local.length} records.`);
    }
  }

  if (!records.length) {
    report("Geography enrichment", [
      "No official geography source was reachable, so nothing was changed.",
      "",
      "Set CHARLOTTE_REZONING_LAYER_URL, or drop a GeoJSON/ArcGIS export at",
      ".civiclens/geography-source.json.",
      ...notes,
    ]);
    return;
  }

  const zipLayer = process.env.ZIP_BOUNDARY_LAYER_URL || DEFAULT_ZIP_LAYER;
  const districtLayer = process.env.COUNCIL_DISTRICT_LAYER_URL || DEFAULT_DISTRICT_LAYER;

  const [zips, districts] = await Promise.all([
    loadBoundariesSafely(zipLayer, "ZIP boundaries", notes),
    loadBoundariesSafely(districtLayer, "Council districts", notes),
  ]);

  notes.push(`Parsed ${records.length} official parcel records.`);

  // Reverse-look-up the ZIP and district for each parcel.
  for (const record of records) {
    const point = { latitude: record.latitude, longitude: record.longitude };
    if (!record.zipCode && zips.length) {
      const zip = locate(zips, point);
      if (zip?.label) record.zipCode = zip.label.slice(0, 5);
    }
    if (districts.length) {
      const district = locate(districts, point);
      if (district) {
        const parsed = numberOrUndefined(district.label);
        if (parsed !== undefined) record.councilDistrict = parsed;
        record.councilDistrictRep = district.rep;
        record.councilDistrictRepEmail = district.email;
      }
    }
  }

  const index = buildGeoIndex(records);
  let exact = 0;
  let likely = 0;
  let unconfirmed = 0;
  let withZip = 0;
  let withDistrict = 0;
  let withZoning = 0;

  const enriched = decisions.map((decision) => {
    const geography = matchDecisionGeography(decision, index);
    if (geography.confidence === "exact") exact += 1;
    else if (geography.confidence === "likely") likely += 1;
    else unconfirmed += 1;

    if (geography.zipCode) withZip += 1;
    if (geography.councilDistrict) withDistrict += 1;

    const next: Dict = { ...decision, geography };

    // Zoning stated by the official dataset gives a real, sourced before/after.
    if (geography.method === "petition-match") {
      const petition = parsePetitionNumber(String(decision.title));
      const record = petition ? index.byPetition.get(petition) : undefined;
      if (record?.existingZoning) {
        next.beforeText = `Zoned ${record.existingZoning} per the city's rezoning dataset.`;
        next.afterText = record.requestedZoning
          ? `Requested to change to ${record.requestedZoning} if adopted.`
          : undefined;
        withZoning += 1;
      }
    }

    return next;
  });

  await writeJson("local-decisions.json", enriched);

  report("Geography enrichment", [
    ...notes,
    "",
    `Matched exactly:        ${exact}/${decisions.length}`,
    `ZIP stated in record:   ${likely}`,
    `Unconfirmed:            ${unconfirmed}`,
    `Now with a ZIP code:    ${withZip}`,
    `Now with a district:    ${withDistrict}`,
    `Now with zoning change: ${withZoning}`,
  ]);

  const supabase = serviceClient();
  if (supabase) {
    const rows = enriched
      .filter((decision) => {
        const geography = decision.geography as Dict | undefined;
        return geography && geography.method !== "none";
      })
      .map((decision) => {
        const geo = decision.geography as Dict;
        return {
          decision_id: decision.id,
          address: geo.address ?? null,
          latitude: geo.latitude ?? null,
          longitude: geo.longitude ?? null,
          zip_code: geo.zipCode ?? null,
          council_district: geo.councilDistrict ?? null,
          neighborhood: geo.neighborhood ?? null,
          parcel_id: geo.parcelId ?? null,
          source_url: geo.sourceUrl ?? null,
          method: geo.method,
          confidence: geo.confidence,
          verified_at: new Date().toISOString(),
        };
      });

    if (rows.length) {
      const { error } = await supabase
        .from("decision_geography")
        .upsert(rows, { onConflict: "decision_id" });
      console.log(
        error ? `  Supabase push failed: ${error.message}` : `  Pushed ${rows.length} rows to Supabase.`,
      );
    }
  } else {
    console.log("  Supabase credentials absent — cache updated only.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
