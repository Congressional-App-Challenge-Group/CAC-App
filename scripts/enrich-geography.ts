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
import {
  placeFields,
  placeLabel,
  resolvePlace,
  type PlaceBoundary,
  type PlaceKind,
} from "../src/lib/place";
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

const GEO_FILES = [".civiclens/geography-source.json", ".civiclens/rezoning-history.json"];

/**
 * The county's own GIS server hosts every boundary layer the product needs.
 *
 * Mecklenburg publishes the city council districts *with* the sitting member's
 * name and city email, so one official server supplies the location, the
 * district and the person to contact — rather than the product assembling a
 * political map out of three unrelated datasets.
 */
const COUNTY_GIS = "https://meckgis.mecklenburgcountync.gov/server/rest/services";

/**
 * Generalization applied to every boundary layer, in degrees (~11 m).
 *
 * Published geometry is survey-grade: bundling it at full resolution costs
 * 5.5 MB, which would be traced into every deployment. At 11 m the whole set is
 * ~0.4 MB and still places an address in the right district; the imprecision is
 * declared in the artifact so a reader can see it rather than assume it.
 */
const GENERALIZATION_DEGREES = process.env.PLACE_BOUNDARY_GENERALIZATION ?? "0.0001";

/**
 * Read a district code out of a layer row.
 *
 * Codes are not consistently typed across the county's layers: council and
 * county publish `"5"` as text, while the school board layer publishes `5` as a
 * number. Accepting only strings silently dropped all six school board
 * districts, which then reported as "0 boundaries loaded" — a success message
 * for a layer that had in fact loaded and been thrown away.
 */
const text = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
};

/** One boundary layer, and how to read its code and representative out. */
type LayerSpec = {
  kind: PlaceKind;
  service: string;
  code: (attributes: Dict) => string | undefined;
  rep?: (attributes: Dict) => string | undefined;
  email?: (attributes: Dict) => string | undefined;
};

const PLACE_LAYERS: LayerSpec[] = [
  {
    kind: "council",
    service: "CharlotteCityCouncilDistricts",
    code: (attributes) => text(pick(attributes, /^district$/i)),
    rep: (attributes) => text(pick(attributes, /^districtrep$/i)),
    email: (attributes) => text(pick(attributes, /^repemail$/i)),
  },
  {
    kind: "county",
    service: "MecklenburgCountyCommissionerDistricts",
    code: (attributes) => text(pick(attributes, /^cc$/i)),
    rep: (attributes) => text(pick(attributes, /^cc_name$/i)),
  },
  {
    kind: "school",
    service: "CMSSchoolBoardDistricts",
    code: (attributes) => text(pick(attributes, /^school$/i)),
  },
  {
    kind: "zip",
    service: "ZipCodeBoundaries",
    code: (attributes) => text(pick(attributes, /^zip$/i)),
  },
  {
    kind: "congress",
    service: "NCCongressDistricts",
    code: (attributes) => text(pick(attributes, /^district$/i)),
  },
  {
    kind: "house",
    service: "NCHouseDistricts",
    code: (attributes) => text(pick(attributes, /^district$/i)),
  },
  {
    kind: "senate",
    service: "NCSenateDistricts",
    code: (attributes) => text(pick(attributes, /^district$/i)),
  },
];

const layerUrl = (spec: LayerSpec) =>
  `${process.env.PLACE_LAYER_BASE_URL || COUNTY_GIS}/${spec.service}/MapServer/0`;

type LayerPage = {
  features?: Dict[];
  error?: { message?: string };
  exceededTransferLimit?: boolean;
};

/** One request to an ArcGIS layer; pass `null` paging to ask for no pagination. */
async function requestPage(
  url: string,
  params: Record<string, string>,
  offset: number | null,
  pageSize: number | null,
): Promise<LayerPage> {
  const query = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
    ...params,
  });
  if (offset !== null && pageSize !== null) {
    query.set("resultOffset", String(offset));
    query.set("resultRecordCount", String(pageSize));
  }

  const response = await fetch(`${url.replace(/\/+$/, "")}/query?${query}`, {
    headers: { "user-agent": "CivicLens/1.0 geography enrichment" },
  });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  const payload = (await response.json()) as LayerPage;
  if (payload.error) throw new Error(payload.error.message ?? "ArcGIS error");
  return payload;
}

/**
 * Query an ArcGIS layer, following pagination for as far as the layer allows.
 *
 * The rezoning history layer answers a first page and then refuses every
 * `resultOffset` with "Pagination is not supported". Throwing there discarded
 * the rows it had already returned, so the whole source looked unreachable and
 * most of the dataset lost the location it had previously been given. A refusal
 * now ends the scan and keeps what came back; `queryLayerByPetition` is what
 * reaches the rows past the first page.
 */
async function queryLayer(
  url: string,
  params: Record<string, string>,
  notes?: string[],
): Promise<Dict[]> {
  const collected: Dict[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < 60_000; offset += pageSize) {
    let payload: LayerPage;
    try {
      payload = await requestPage(url, params, offset, pageSize);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (offset > 0 && /pagination/i.test(message)) {
        notes?.push(
          `  ${url.split("/services/")[1] ?? url}: stopped at ${collected.length} rows ` +
            `because the layer refuses paging beyond its first response.`,
        );
        break;
      }
      throw error;
    }

    const features = payload.features ?? [];
    collected.push(...features);
    if (features.length < pageSize && !payload.exceededTransferLimit) break;
  }

  return collected;
}

/**
 * The petition numbers this dataset already names, oldest removed.
 *
 * The rezoning history layer holds every petition the city has ever decided, and
 * refuses to page past its first response ("Pagination is not supported").
 * Scanning it whole is therefore impossible and unnecessary: at most a few
 * hundred petitions appear in the records held here, so the layer can be asked
 * for exactly those by key.
 */
function petitionNumbersIn(decisions: Dict[]): string[] {
  const found = new Set<string>();
  for (const decision of decisions) {
    const petition = parsePetitionNumber(String(decision.title ?? ""));
    if (petition) found.add(petition);
  }
  return [...found];
}

/**
 * Ask a layer for specific petitions, in batches small enough for one request.
 *
 * Each batch is independent: this server intermittently answers a keyed query
 * with an ArcGIS 400, and one bad batch should cost only its own rows rather
 * than the whole layer. A batch that fails is counted and reported.
 */
async function queryLayerByPetition(
  url: string,
  petitions: string[],
  notes: string[],
): Promise<{ features: Dict[]; failed: number }> {
  const features: Dict[] = [];
  let failed = 0;
  const batchSize = 10;
  for (let index = 0; index < petitions.length; index += batchSize) {
    const batch = petitions.slice(index, index + batchSize);
    const where = `Petition IN (${batch.map((value) => `'${value.replace(/'/g, "''")}'`).join(",")})`;
    try {
      features.push(...(await queryLayer(url, { where })));
    } catch {
      failed += 1;
    }
  }
  if (failed) {
    notes.push(`  ${failed} keyed batch(es) on this layer returned an error and were skipped.`);
  }
  return { features, failed };
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

/**
 * Fetch one boundary layer as placed districts.
 *
 * A row with no readable code is dropped rather than kept as an unlabelled
 * polygon: a district nobody can name cannot be shown to anyone, and keeping it
 * would let a point resolve to a district with an empty code.
 */
async function loadPlaceLayer(spec: LayerSpec): Promise<PlaceBoundary[]> {
  const url = layerUrl(spec);
  const features = await queryLayer(url, {
    returnCentroid: "false",
    maxAllowableOffset: GENERALIZATION_DEGREES,
    geometryPrecision: "5",
  });

  const boundaries: PlaceBoundary[] = [];
  for (const feature of features) {
    const attributes = (feature.attributes as Dict | undefined) ?? feature;
    const rings = toPolygonRings(feature.geometry);
    if (!rings.length) continue;

    const code = spec.code(attributes);
    if (!code) continue;

    boundaries.push({
      kind: spec.kind,
      code,
      label: placeLabel(spec.kind, code),
      rep: spec.rep?.(attributes),
      email: spec.email?.(attributes),
      sourceUrl: url,
      rings,
    });
  }

  return boundaries;
}

async function loadPlaceLayerSafely(
  spec: LayerSpec,
  notes: string[],
): Promise<PlaceBoundary[]> {
  try {
    const boundaries = await loadPlaceLayer(spec);
    const named = boundaries.filter((boundary) => boundary.rep).length;
    notes.push(
      `${boundaryLabel(spec.kind)}: ${boundaries.length} boundary polygons loaded` +
        (named ? `, ${named} with a named representative` : "") +
        ".",
    );
    return boundaries;
  } catch (error) {
    notes.push(
      `${boundaryLabel(spec.kind)}: unavailable (${error instanceof Error ? error.message : "unknown"}).`,
    );
    return [];
  }
}

function boundaryLabel(kind: PlaceKind): string {
  return kind === "zip" ? "ZIP boundaries" : `${placeKindName(kind)} boundaries`;
}

function placeKindName(kind: PlaceKind): string {
  switch (kind) {
    case "council":
      return "City council";
    case "county":
      return "County commission";
    case "school":
      return "School board";
    case "congress":
      return "Congressional";
    case "house":
      return "NC House";
    case "senate":
      return "NC Senate";
    default:
      return "ZIP";
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

  const wanted = petitionNumbersIn(decisions);
  const records: GeoRecord[] = [];
  for (const url of layerUrls) {
    const label = url.split("/services/")[1] ?? url;

    /*
     * Both reads, every time, and merged.
     *
     * The scan covers whatever the layer will page through; the keyed read
     * reaches the rows past the first page, which is where the history layer
     * keeps older petitions. Each can fail on its own — the keyed queries
     * intermittently return an ArcGIS 400 — so taking only one of them meant a
     * partial failure silently halved the parcel coverage instead of reducing it
     * slightly.
     */
    let scanned: Dict[] = [];
    try {
      scanned = await queryLayer(url, { returnCentroid: "true" }, notes);
    } catch (error) {
      notes.push(
        `Rezoning layer ${label} scan failed: ${error instanceof Error ? error.message : "unknown"}.`,
      );
    }

    const keyed = wanted.length
      ? await queryLayerByPetition(url, wanted, notes)
      : { features: [], failed: 0 };

    const seen = new Set<string>();
    const features = [...scanned, ...keyed.features].filter((feature) => {
      const attributes = (feature.attributes as Dict | undefined) ?? feature;
      const petition = String(attributes.Petition ?? attributes.petition ?? "");
      if (!petition) return true;
      if (seen.has(petition)) return false;
      seen.add(petition);
      return true;
    });

    const mapped = toGeoRecords(features, url);
    records.push(...mapped);
    notes.push(
      `Rezoning layer ${label}: ${mapped.length} parcels` +
        (keyed.features.length ? `, ${keyed.features.length} rows asked for by petition number.` : "."),
    );
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

  const loaded = await Promise.all(
    PLACE_LAYERS.map((spec) => loadPlaceLayerSafely(spec, notes)),
  );
  const boundaries = loaded.flat();

  /*
   * The boundary set is written to disk as well as used here.
   *
   * Resolving a *record* only needs the districts already stamped on it, which
   * keeps place matching working in the static deployment with no polygons at
   * all. Resolving a *reader's address* is the opposite: it needs real geometry,
   * so the generalised layers are bundled for the address lookup and nothing
   * else. Absent, the lookup reports that it cannot place the address rather
   * than guessing from the ZIP.
   */
  if (boundaries.length) {
    await writeJson("place-boundaries.json", {
      generatedAt: new Date().toISOString(),
      source: process.env.PLACE_LAYER_BASE_URL || COUNTY_GIS,
      generalizationDegrees: Number(GENERALIZATION_DEGREES),
      note:
        "Boundary geometry published by Mecklenburg County, generalised to roughly 11 m " +
        "so it can be bundled. Used to place a reader's own address; record-level " +
        "district matching reads the codes already stored on each record.",
      boundaries,
    }, 0);
  }

  notes.push(`Parsed ${records.length} official parcel records.`);

  // Reverse-look-up every district for each parcel, once.
  let locatedParcels = 0;
  for (const record of records) {
    const fields = placeFields(
      resolvePlace({ latitude: record.latitude, longitude: record.longitude }, boundaries),
    );
    if (fields.councilDistrict !== undefined || fields.zipCode) locatedParcels += 1;
    for (const [key, value] of Object.entries(fields) as Array<[keyof typeof fields, string | number | undefined]>) {
      if (value === undefined) continue;
      // A ZIP the official record already states is never overwritten.
      if (key === "zipCode" && record.zipCode) continue;
      (record as unknown as Record<string, unknown>)[key] = value;
    }
  }

  const index = buildGeoIndex(records);
  let exact = 0;
  let likely = 0;
  let unconfirmed = 0;
  let withZip = 0;
  let withDistrict = 0;
  let withCounty = 0;
  let withSchool = 0;
  let withCongress = 0;
  let withZoning = 0;

  let kept = 0;

  const enriched = decisions.map((decision) => {
    const matched = matchDecisionGeography(decision, index);

    /*
     * A record that was already placed stays placed when this run cannot place
     * it again.
     *
     * Enrichment is a re-derivation, not a correction: it rewrites every record
     * from whatever the source layers returned this time. When one of those
     * layers fails to load, its records came back "none" and were written back
     * as unconfirmed — so a temporary upstream failure silently turned 124
     * located records into 19 and made the disclosure page claim a 98% location
     * gap that was really a gap in our own run. Keeping the prior placement is
     * the honest reading: nothing contradicted it.
     */
    const previous = decision.geography as Dict | undefined;
    const keepPrevious =
      matched.method === "none" && typeof previous?.method === "string" && previous.method !== "none";
    const geography = keepPrevious ? (previous as unknown as ReturnType<typeof matchDecisionGeography>) : matched;
    if (keepPrevious) kept += 1;

    if (geography.confidence === "exact") exact += 1;
    else if (geography.confidence === "likely") likely += 1;
    else unconfirmed += 1;

    if (geography.zipCode) withZip += 1;
    if (geography.councilDistrict) withDistrict += 1;
    if (geography.countyDistrict) withCounty += 1;
    if (geography.schoolBoardDistrict) withSchool += 1;
    if (geography.congressionalDistrict) withCongress += 1;

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
    ...(kept
      ? [
          `Kept from a previous run: ${kept}`,
          "  These were placed before and this run could not re-place them, so the",
          "  earlier placement stands rather than being reported as no location.",
        ]
      : []),
    "",
    `Now with a ZIP code:    ${withZip}`,
    `Now with a council district:  ${withDistrict}`,
    `Now with a county district:   ${withCounty}`,
    `Now with a school district:   ${withSchool}`,
    `Now with a congressional district: ${withCongress}`,
    `Now with zoning change: ${withZoning}`,
    "",
    `Parcels placed in a district: ${locatedParcels}/${records.length}`,
    `Districts bundled for address lookup: ${boundaries.length}`,
    "",
    "Records with no location are reported as unconfirmed, never placed in the",
    "nearest district. Place matching can only see the records that were located.",
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
          // The representative and acreage were long produced by the matcher and
          // read by the participation panel, but never pushed here — so the panel
          // rendered nothing whenever Supabase was configured.
          council_district_rep: geo.councilDistrictRep ?? null,
          council_district_rep_email: geo.councilDistrictRepEmail ?? null,
          // Districts resolved from the county's own boundary layers. These were
          // previously produced and never stored, so the same record showed its
          // districts on the static dataset and none against Supabase.
          county_district: geo.countyDistrict ?? null,
          county_district_rep: geo.countyDistrictRep ?? null,
          county_district_rep_email: geo.countyDistrictRepEmail ?? null,
          school_board_district: geo.schoolBoardDistrict ?? null,
          congressional_district: geo.congressionalDistrict ?? null,
          state_house_district: geo.stateHouseDistrict ?? null,
          state_senate_district: geo.stateSenateDistrict ?? null,
          acres: geo.acres ?? null,
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
