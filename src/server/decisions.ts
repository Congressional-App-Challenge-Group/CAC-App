import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  CivicSource,
  Decision,
  DecisionChange,
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
  };

  const drafts = (row.decision_drafts || []).map(mapDraftRow);
  return drafts.length ? applyApprovedDrafts(decision, drafts) : decision;
}

/* -------------------------------------------------------------------------- */
/* Local artifact fallback                                                     */
/* -------------------------------------------------------------------------- */

async function readArtifact<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(resolve(process.cwd(), ".civiclens", file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function localDecisions(): Promise<Decision[]> {
  return (await readArtifact<Decision[]>("local-decisions.json")) ?? [];
}

async function localDrafts(): Promise<DecisionDraft[]> {
  return (await readArtifact<DecisionDraft[]>("drafts.json")) ?? [];
}

function pruneForList(decision: Decision): Decision {
  return {
    ...decision,
    summary: excerpt(decision.summary, 420),
    latestUpdate: excerpt(decision.latestUpdate, 280),
    sources: [],
    timeline: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Readers                                                                     */
/* -------------------------------------------------------------------------- */

const baseListSelection =
  "id,slug,title,organization,topic,status,summary,why_it_matters,latest_update,next_step,published_at,updated_at,approved_at,archived_at,last_checked_at,affected_roles,affected_zip_codes,affected_areas,important_dates,before_text,after_text,is_published,amount_usd,fiscal_year,funding_source";

const spineListSelection = `${baseListSelection},decision_geography(address,latitude,longitude,zip_code,council_district,neighborhood,method,confidence)`;

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

  if (error && /decision_geography|decision_drafts|amount_usd/.test(error.message)) {
    console.warn(
      "CivicLens spine columns are missing — apply supabase/migrations/202609010001_civiclens_spine.sql. Falling back to base selection.",
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
    const found = local.find((decision) => decision.slug === slugOrId || decision.id === slugOrId) || null;
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

  if (error && /decision_geography|decision_drafts/.test(error.message)) {
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
