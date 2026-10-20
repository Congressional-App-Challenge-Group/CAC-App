import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CivicSource,
  Decision,
  ObservatoryStory,
  DecisionChange,
  DecisionDeadline,
  DecisionDraft,
  DecisionGeography,
  DecisionMoney,
  GeoConfidence,
  GeoMethod,
  ImportantDate,
  TimelineEvent,
  UserRole,
} from "@/types";
import { applyApprovedDrafts } from "@/lib/enrichment";

type Row = Record<string, unknown> & {
  sources?: Record<string, unknown>[];
  timeline_events?: Record<string, unknown>[];
  decision_geography?: Record<string, unknown> | Record<string, unknown>[] | null;
  decision_drafts?: Record<string, unknown>[] | null;
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const numberOrUndefined = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const excerpt = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max).replace(/\s+\S*$/, "")}…`;

/* -------------------------------------------------------------------------- */
/* Row mapping                                                                 */
/* -------------------------------------------------------------------------- */

function mapSource(row: Record<string, unknown>): CivicSource {
  return {
    id: text(row.id),
    decisionId: text(row.decision_id),
    title: text(row.title),
    organization: text(row.organization),
    url: text(row.url),
    publishedAt: text(row.published_at) || undefined,
    pageReference: text(row.page_reference) || undefined,
    lastVerifiedAt: text(row.last_verified_at),
    verificationStatus: text(row.verification_status, "unconfirmed") as CivicSource["verificationStatus"],
  };
}

function mapEvent(row: Record<string, unknown>): TimelineEvent {
  return {
    id: text(row.id),
    decisionId: text(row.decision_id),
    date: text(row.date),
    stage: text(row.stage) as TimelineEvent["stage"],
    title: text(row.title),
    description: text(row.description),
    whatChanged: text(row.what_changed) || undefined,
    state: text(row.state, "current") as TimelineEvent["state"],
    sourceId: text(row.source_id) || undefined,
    verificationStatus: text(row.verification_status, "unconfirmed") as TimelineEvent["verificationStatus"],
  };
}

function mapGeography(row: Row): DecisionGeography | undefined {
  const raw = Array.isArray(row.decision_geography) ? row.decision_geography[0] : row.decision_geography;
  if (!raw) return undefined;
  return {
    address: text(raw.address) || undefined,
    latitude: numberOrUndefined(raw.latitude),
    longitude: numberOrUndefined(raw.longitude),
    zipCode: text(raw.zip_code) || undefined,
    councilDistrict: numberOrUndefined(raw.council_district),
    // District representatives and acreage come from the county's own layers. They
    // were produced by the matcher and rendered by the participation panel for
    // some time before there was anywhere to store them, which meant the panel
    // worked on the static dataset and rendered nothing against Supabase.
    councilDistrictRep: text(raw.council_district_rep) || undefined,
    councilDistrictRepEmail: text(raw.council_district_rep_email) || undefined,
    countyDistrict: numberOrUndefined(raw.county_district),
    countyDistrictRep: text(raw.county_district_rep) || undefined,
    countyDistrictRepEmail: text(raw.county_district_rep_email) || undefined,
    schoolBoardDistrict: numberOrUndefined(raw.school_board_district),
    congressionalDistrict: text(raw.congressional_district) || undefined,
    stateHouseDistrict: text(raw.state_house_district) || undefined,
    stateSenateDistrict: text(raw.state_senate_district) || undefined,
    acres: numberOrUndefined(raw.acres),
    neighborhood: text(raw.neighborhood) || undefined,
    parcelId: text(raw.parcel_id) || undefined,
    sourceUrl: text(raw.source_url) || undefined,
    method: text(raw.method, "none") as GeoMethod,
    confidence: text(raw.confidence, "unconfirmed") as GeoConfidence,
    verifiedAt: text(raw.verified_at) || undefined,
  };
}

function mapMoney(row: Row): DecisionMoney | undefined {
  const amount = numberOrUndefined(row.amount_usd);
  const fiscalYear = text(row.fiscal_year) || undefined;
  const fundingSource = text(row.funding_source) || undefined;
  if (amount === undefined && !fiscalYear && !fundingSource) return undefined;
  return { amountUsd: amount, fiscalYear, fundingSource };
}

/**
 * The next scheduled official action, as published by the government's own
 * register. Absent means the record states no date, which the interface reports
 * as "no date on record" rather than substituting a guess.
 */
function mapDeadline(row: Row): DecisionDeadline | undefined {
  const date = text(row.deadline_date).slice(0, 10);
  if (!date) return undefined;
  const origin = text(row.deadline_origin, "official-tracker");
  return {
    date,
    label: text(row.deadline_label) || undefined,
    sourceUrl: text(row.deadline_source_url) || undefined,
    officialStatus: text(row.official_status) || undefined,
    origin: origin === "record-text" ? "record-text" : "official-tracker",
  };
}

function mapDraftRow(row: Record<string, unknown>): DecisionDraft {
  const excerpts = row.source_excerpts;
  return {
    id: text(row.id),
    decisionId: text(row.decision_id),
    field: text(row.field) as DecisionDraft["field"],
    draftText: text(row.draft_text),
    model: text(row.model),
    promptVersion: text(row.prompt_version),
    sourceExcerpts: Array.isArray(excerpts) ? (excerpts as string[]) : [],
    status: text(row.status, "pending") as DecisionDraft["status"],
    editorId: text(row.editor_id) || null,
    reviewedAt: text(row.reviewed_at) || null,
    createdAt: text(row.created_at),
  };
}

function mapDecision(row: Row): Decision {
  const decision: Decision = {
    id: text(row.id),
    slug: text(row.slug),
    title: text(row.title),
    organization: text(row.organization) as Decision["organization"],
    topic: text(row.topic),
    status: text(row.status) as Decision["status"],
    summary: text(row.summary),
    whyItMatters: text(row.why_it_matters),
    latestUpdate: text(row.latest_update),
    nextStep: text(row.next_step) || null,
    publishedAt: text(row.published_at),
    updatedAt: text(row.updated_at),
    approvedAt: text(row.approved_at) || null,
    archivedAt: text(row.archived_at) || null,
    lastCheckedAt: text(row.last_checked_at) || null,
    affectedRoles: (row.affected_roles as UserRole[]) || [],
    affectedZipCodes: (row.affected_zip_codes as string[]) || [],
    affectedAreas: (row.affected_areas as string[]) || [],
    importantDates: (row.important_dates as ImportantDate[]) || [],
    beforeText: text(row.before_text) || undefined,
    afterText: text(row.after_text) || undefined,
    isPublished: Boolean(row.is_published),
    sources: (row.sources || []).map(mapSource),
    timeline: (row.timeline_events || []).map(mapEvent).sort((a, b) => a.date.localeCompare(b.date)),
    geography: mapGeography(row),
    money: mapMoney(row),
    deadline: mapDeadline(row),
    requester: text(row.requester) || undefined,
    // Matter identity. Absent on rows written before the collapse existed, which
    // the interface treats the same way as any other unconfirmed field.
    matterKey: text(row.matter_key) || undefined,
    appearanceIds: Array.isArray(row.appearance_ids) ? (row.appearance_ids as string[]) : undefined,
    appearanceCount: numberOrUndefined(row.appearance_count),
    firstSeenAt: text(row.first_seen_at) || undefined,
    lastActivityAt: text(row.last_activity_at) || undefined,
  };

  const drafts = (row.decision_drafts || []).map(mapDraftRow);
  return drafts.length ? applyApprovedDrafts(decision, drafts) : decision;
}

/* -------------------------------------------------------------------------- */
/* Local artifact fallback                                                     */
/* -------------------------------------------------------------------------- */

const warned = new Set<string>();

const warnOnce = (key: string, message: string) => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
};

async function readArtifact<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(resolve(process.cwd(), ".civiclens", file), "utf8")) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    // A missing optional artifact is normal on a first run (an empty change log,
    // for instance). Only the primary dataset being absent is worth shouting
    // about, because an empty site previously looked identical to "no data yet".
    if (code === "ENOENT") {
      if (file === "local-decisions.json") {
        warnOnce(
          file,
          "[civiclens] No static dataset found and Supabase is not configured, so public pages " +
            "will render empty. Run `pnpm ensure:data` to generate .civiclens/local-decisions.json.",
        );
      }
      return null;
    }

    warnOnce(
      file,
      `[civiclens] .civiclens/${file} exists but could not be read (${
        error instanceof Error ? error.message : "unknown"
      }). Continuing without it.`,
    );
    return null;
  }
}

async function localDecisions(): Promise<Decision[]> {
  return (await readArtifact<Decision[]>("local-decisions.json")) ?? [];
}

async function localDrafts(): Promise<DecisionDraft[]> {
  return (await readArtifact<DecisionDraft[]>("drafts.json")) ?? [];
}

async function localAliases(): Promise<Record<string, string>> {
  return (await readArtifact<Record<string, string>>("slug-aliases.json")) ?? {};
}

/**
 * A slug retired by the matter collapse.
 *
 * Merging ten appearances into one matter leaves nine public URLs pointing at
 * nothing. A link someone already shared should not 404 because CivicLens
 * corrected its own counting, so the retired slug resolves to its survivor.
 */
export async function resolveSlugAlias(slug: string): Promise<string | null> {
  return (await localAliases())[slug] ?? null;
}

/**
 * Trims a decision for a list view.
 *
 * `sources` and `timeline` are dropped because a card never renders them and
 * they dominate the payload. That makes this function's output *unsafe to
 * measure with*: a caller that counts sources or timeline events gets zero for
 * every record, and two figures on the disclosure page quietly read 100% because
 * of it — "no official link" and "never recorded a second action" — while the
 * records themselves cite sources and carry multi-event timelines.
 *
 * Anything that counts must ask for `withRelations` instead of using the list
 * shape. The marker below is read by `assertMeasurable` so that mistake fails
 * loudly rather than publishing a false number.
 */
/*
 * The marker is a WeakSet rather than a property on the object.
 *
 * Attaching a symbol made the record non-plain, and React refuses to pass such
 * an object from a Server Component to a Client Component — the home page list
 * echoed "Objects with symbol properties like civiclens.pruned are not
 * supported" for every card. A side table keeps the same signal without
 * changing the shape of data that crosses the server/client boundary.
 */
const PRUNED = new WeakSet<object>();

function pruneForList(decision: Decision): Decision {
  const pruned: Decision = {
    ...decision,
    summary: excerpt(decision.summary, 420),
    latestUpdate: excerpt(decision.latestUpdate, 280),
    sources: [],
    timeline: [],
  };
  PRUNED.add(pruned);
  return pruned;
}

/** True when a decision came from the pruned list shape rather than a full read. */
export function isPrunedForList(decision: Decision): boolean {
  return PRUNED.has(decision);
}

/* -------------------------------------------------------------------------- */
/* Readers                                                                     */
/* -------------------------------------------------------------------------- */

const baseListSelection =
  "id,slug,title,organization,topic,status,summary,why_it_matters,latest_update,next_step,published_at,updated_at,approved_at,archived_at,last_checked_at,affected_roles,affected_zip_codes,affected_areas,important_dates,before_text,after_text,is_published,amount_usd,fiscal_year,funding_source,requester,deadline_date,deadline_label,deadline_source_url,deadline_origin,official_status,matter_key,appearance_ids,appearance_count,first_seen_at,last_activity_at";

/** Columns added by the spine, deadlines and matters migrations. */
const SPINE_MISSING =
  /decision_geography|decision_drafts|amount_usd|requester|deadline_date|official_status|matter_key/;

const GEOGRAPHY_COLUMNS =
  "address,latitude,longitude,zip_code,council_district,council_district_rep,council_district_rep_email," +
  "county_district,county_district_rep,county_district_rep_email,school_board_district," +
  "congressional_district,state_house_district,state_senate_district,acres,neighborhood,method,confidence";

const spineListSelection = `${baseListSelection},decision_geography(${GEOGRAPHY_COLUMNS})`;

const spineDetailSelection =
  "*, sources(*), timeline_events(*), decision_geography(*), decision_drafts(*)";

type GetOptions = { includeArchived?: boolean; limit?: number; withRelations?: boolean };

/**
 * Read public decisions.
 *
 * The spine tables (geography/drafts) are queried first; if the migration that
 * creates them has not been applied yet, we retry with the base selection so the
 * site keeps working rather than going blank.
 */
export async function getDecisions(options: GetOptions = {}): Promise<Decision[]> {
  const supabase = client();
  if (!supabase) {
    const local = await localDecisions();
    const withDrafts = await applyLocalDrafts(local);
    return options.withRelations ? withDrafts : withDrafts.map(pruneForList);
  }

  const buildQuery = (selection: string) => {
    let query = supabase
      .from("decisions")
      .select(selection)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(options.limit || 250);
    if (!options.includeArchived) query = query.is("archived_at", null);
    return query;
  };

  let { data, error } = await buildQuery(options.withRelations ? spineDetailSelection : spineListSelection);

  if (error && SPINE_MISSING.test(error.message)) {
    console.warn(
      "CivicLens spine columns are missing — apply the supabase/migrations/202609010001 and " +
        "202609130001 migrations. Falling back to the base selection.",
    );
    ({ data, error } = await buildQuery(options.withRelations ? "*, sources(*), timeline_events(*)" : baseListSelection));
  }

  if (error) {
    // Never fail silently: an empty list previously looked identical to "no data".
    console.error("Unable to load CivicLens decisions:", error.message);
    return [];
  }

  const mapped = (data as unknown as Row[]).map(mapDecision);
  if (options.includeArchived) return mapped;

  // Cap per organization so one prolific source cannot dominate the list.
  const counts = new Map<string, number>();
  return mapped.filter((decision) => {
    const count = counts.get(decision.organization) || 0;
    if (count >= 50) return false;
    counts.set(decision.organization, count + 1);
    return true;
  });
}

async function applyLocalDrafts(decisions: Decision[]): Promise<Decision[]> {
  const drafts = await localDrafts();
  if (!drafts.length) return decisions;
  const byDecision = new Map<string, DecisionDraft[]>();
  for (const draft of drafts) {
    const bucket = byDecision.get(draft.decisionId);
    if (bucket) bucket.push(draft);
    else byDecision.set(draft.decisionId, [draft]);
  }
  return decisions.map((decision) => {
    const own = byDecision.get(decision.id);
    return own ? applyApprovedDrafts(decision, own) : decision;
  });
}

export async function getDecision(slugOrId: string): Promise<Decision | null> {
  const supabase = client();
  if (!supabase) {
    const local = await localDecisions();
    const lookup = (value: string) =>
      local.find((decision) => decision.slug === value || decision.id === value) ?? null;
    let found = lookup(slugOrId);
    if (!found) {
      const alias = (await localAliases())[slugOrId];
      if (alias) found = lookup(alias);
    }
    if (!found) return null;
    const [withDrafts] = await applyLocalDrafts([found]);
    return withDrafts;
  }

  const field = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(slugOrId) ? "id" : "slug";
  let { data, error } = await supabase
    .from("decisions")
    .select(spineDetailSelection)
    .eq("is_published", true)
    .eq(field, slugOrId)
    .maybeSingle();

  if (error && SPINE_MISSING.test(error.message)) {
    ({ data, error } = await supabase
      .from("decisions")
      .select("*, sources(*), timeline_events(*)")
      .eq("is_published", true)
      .eq(field, slugOrId)
      .maybeSingle());
  }

  if (error) {
    console.error("Unable to load CivicLens decision:", error.message);
    return null;
  }
  if (!data) return null;
  return mapDecision(data as unknown as Row);
}

/** Recently detected changes, newest first. */
export async function getObservatoryStory(): Promise<ObservatoryStory | null> {
  const all = await getDecisions({ withRelations: true, limit: 1000 });
  const featured = all
    .filter((decision) =>
      decision.sources.some((source) => source.verificationStatus === "verified" && Boolean(source.url)) &&
      decision.timeline.some((event) => event.verificationStatus === "verified") &&
      decision.geography?.confidence === "exact" &&
      Number.isFinite(decision.geography.latitude) &&
      Number.isFinite(decision.geography.longitude),
    )
    .sort((a, b) => {
      const storyScore = (decision: Decision) => {
        const verified = decision.timeline.filter((event) => event.verificationStatus === "verified");
        const stages = new Set(verified.map((event) => event.stage)).size;
        const dates = new Set(verified.map((event) => event.date)).size;
        return stages * 100 + dates * 10 + verified.length;
      };
      return storyScore(b) - storyScore(a) || b.updatedAt.localeCompare(a.updatedAt);
    })[0];

  const source = featured?.sources.find((entry) => entry.verificationStatus === "verified" && Boolean(entry.url));
  if (!featured || !source) return null;
  const verifiedTimeline = featured.timeline
    .filter((event) => event.verificationStatus === "verified")
    .sort((a, b) => a.date.localeCompare(b.date));
  const storyTimeline = verifiedTimeline;
  const latestRecordedEvent = [...verifiedTimeline].reverse().find((event) => event.title !== "First tracked appearance");
  const currentStoryDate = featured.deadline?.date && featured.deadline.date >= new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()) ? featured.deadline.date : undefined;
  const storySource = latestRecordedEvent?.sourceId
    ? featured.sources.find((entry) => entry.id === latestRecordedEvent.sourceId) ?? source
    : source;
  const boundaryKind = featured.organization === "charlotte" ? "council" : "county";

  const related = all
    .filter((decision) => decision.id !== featured.id && decision.organization === featured.organization && decision.topic === featured.topic)
    .slice(0, 3)
    .map(({ slug, title, organization, status }) => ({ slug, title, organization, status }));

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const deadlines = all
    .filter((decision) =>
      decision.deadline?.date &&
      decision.deadline.date >= today &&
      decision.sources.some((entry) => entry.verificationStatus === "verified" && Boolean(entry.url)),
    )
    .sort((a, b) => (a.deadline?.date ?? "").localeCompare(b.deadline?.date ?? ""))
    .slice(0, 4)
    .map((decision) => {
      const recordSource = decision.sources.find((entry) => entry.verificationStatus === "verified" && Boolean(entry.url));
      return {
        slug: decision.slug,
        title: decision.title,
        organization: decision.organization,
        status: decision.status,
        date: decision.deadline!.date!,
        label: decision.deadline!.label ?? decision.deadline!.officialStatus ?? decision.status,
        sourceUrl: decision.deadline!.sourceUrl ?? recordSource?.url,
        sourceTitle: recordSource?.title,
        scope: decision.geography?.confidence === "exact"
          ? [decision.geography.zipCode ? `ZIP ${decision.geography.zipCode}` : undefined,
              decision.geography.councilDistrict ? `City Council District ${decision.geography.councilDistrict}` : undefined]
              .filter(Boolean).join(" · ") || undefined
          : undefined,
      };
    });

  let district: ObservatoryStory["district"];
  try {
    const artifact = JSON.parse(await readFile(resolve(process.cwd(), ".civiclens", "place-boundaries.json"), "utf8")) as {
      source?: string;
      boundaries?: { kind: string; code: string; label: string; sourceUrl?: string; rings: number[][][] }[];
    };
    const boundary = artifact.boundaries?.find((entry) =>
      entry.kind === boundaryKind && String(boundaryKind === "council" ? featured.geography?.councilDistrict : featured.geography?.countyDistrict) === entry.code,
    );
    if (boundary) district = {
      kind: boundary.kind,
      code: boundary.code,
      label: boundary.label,
      sourceUrl: boundary.sourceUrl,
      rings: boundary.rings,
    };
  } catch {
    // The story remains useful without local boundary polygons.
  }

  return {
    featured: {
      id: featured.id,
      slug: featured.slug,
      title: featured.title,
      organization: featured.organization,
      topic: featured.topic,
      status: featured.status,
      summary: featured.summary,
      latestUpdate: featured.latestUpdate,
      deadline: featured.deadline,
      geography: featured.geography,
      source: storySource,
      timeline: storyTimeline,
      currentStoryDate,
    },
    related,
    deadlines,
    district,
  };
}

export async function getRecentChanges(options: { days?: number; limit?: number } = {}): Promise<DecisionChange[]> {
  const limit = options.limit ?? 40;
  const supabase = client();

  if (!supabase) {
    const local = (await readArtifact<DecisionChange[]>("changes.json")) ?? [];
    return local.slice(0, limit);
  }

  let query = supabase
    .from("decision_changes")
    .select("id,decision_id,field,previous_value,current_value,changed_at,source_url")
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (options.days && options.days > 0) {
    query = query.gte("changed_at", new Date(Date.now() - options.days * 86_400_000).toISOString());
  }

  const { data, error } = await query;
  if (error) {
    // The changes table only exists after the spine migration.
    if (!/decision_changes/.test(error.message)) {
      console.error("Unable to load CivicLens changes:", error.message);
    }
    return [];
  }

  const changes = (data as unknown as Record<string, unknown>[]).map((row) => ({
    id: text(row.id),
    decisionId: text(row.decision_id),
    slug: "",
    title: "",
    organization: "charlotte" as DecisionChange["organization"],
    field: text(row.field) as DecisionChange["field"],
    previous: text(row.previous_value) || null,
    current: text(row.current_value) || null,
    changedAt: text(row.changed_at),
    sourceUrl: text(row.source_url) || undefined,
  }));

  // Fill in display fields from the decision list so the feed can render titles.
  if (!changes.length) return changes;
  const decisions = await getDecisions({ limit: 250 });
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  return changes.map((change) => {
    const decision = byId.get(change.decisionId);
    return decision
      ? { ...change, slug: decision.slug, title: decision.title, organization: decision.organization }
      : change;
  });
}

/** Pending plain-language drafts for the editorial queue. */
export async function getPendingDrafts(limit = 100): Promise<DecisionDraft[]> {
  const supabase = client();
  if (!supabase) {
    const local = await localDrafts();
    return local.filter((draft) => draft.status === "pending").slice(0, limit);
  }
  const { data, error } = await supabase
    .from("decision_drafts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!/decision_drafts/.test(error.message)) {
      console.error("Unable to load drafts:", error.message);
    }
    return [];
  }
  return (data as unknown as Record<string, unknown>[]).map(mapDraftRow);
}
