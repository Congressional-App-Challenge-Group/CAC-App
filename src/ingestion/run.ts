import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { collectLegistar } from "./adapters/legistar";
import { collectLinkPage } from "./adapters/link-page";
import { slugify } from "./normalize";
import { governmentSources } from "./sources";
import type { NormalizedItem, SourceConfig } from "./types";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateFromDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export async function runIngestion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const database = createClient(url, key, { auth: { persistSession: false } });
  const requestedSource = process.env.INGEST_SOURCE;
  const selectedSources = requestedSource
    ? governmentSources.filter((source) => source.key === requestedSource)
    : governmentSources;

  if (!selectedSources.length) throw new Error(`Unknown source: ${requestedSource}`);

  for (const source of selectedSources) {
    await runSource(database, source);
  }

  await database.rpc("archive_stale_decisions");
}

async function runSource(database: SupabaseClient, source: SourceConfig) {
  const { data: run, error: runError } = await database
    .from("ingestion_runs")
    .insert({ source_key: source.key })
    .select("id")
    .single();

  if (runError) throw runError;

  try {
    const lookback = Number(process.env.INGEST_LOOKBACK_DAYS || 180);
    const result =
      source.kind === "legistar"
        ? await collectLegistar(source, dateFromDaysAgo(lookback))
        : await collectLinkPage(source);

    let changedDocuments = 0;
    const documentIds = new Map<string, string>();

    for (const value of result.documents) {
      const raw = value as Record<string, unknown>;
      const externalId = String(raw.EventId || raw.externalId);
      const contentHash = hash(raw);

      const { data: previous } = await database
        .from("raw_documents")
        .select("id,content_hash")
        .eq("source_key", source.key)
        .eq("external_id", externalId)
        .maybeSingle();

      if (previous?.content_hash !== contentHash) changedDocuments += 1;

      const { data: document, error: documentError } = await database
        .from("raw_documents")
        .upsert(
          {
            source_key: source.key,
            external_id: externalId,
            canonical_url: String(raw.EventAgendaFile || raw.url || source.url),
            title: String(raw.EventBodyName || raw.title || source.name),
            published_at: raw.EventDate || null,
            content_hash: contentHash,
            content_type: raw.html ? "text/html" : "application/json",
            extracted_text: raw.html
              ? String(raw.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500_000)
              : null,
            raw_payload: raw,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "source_key,external_id" },
        )
        .select("id")
        .single();

      if (documentError) throw documentError;
      documentIds.set(externalId, document.id);
    }

    for (const item of result.items) {
      const documentId = documentIds.get(item.documentExternalId);
      if (documentId) await storeCandidate(database, source, item, documentId);
    }

    await database
      .from("ingestion_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        documents_found: result.documents.length,
        documents_changed: changedDocuments,
        candidates_found: result.items.length,
      })
      .eq("id", run.id);

    console.log(
      `${source.key}: ${result.documents.length} documents, ` +
        `${result.items.length} substantive items, ${changedDocuments} changed`,
    );
  } catch (error) {
    await database
      .from("ingestion_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", run.id);

    throw error;
  }
}

async function storeCandidate(
  database: SupabaseClient,
  source: SourceConfig,
  item: NormalizedItem,
  rawDocumentId: string,
) {
  const candidate = {
    raw_document_id: rawDocumentId,
    source_key: source.key,
    external_item_id: item.externalId,
    title: item.title,
    body: item.body,
    proposed_status: item.status,
    event_date: item.eventDate,
    action_date: ["Approved", "Rejected"].includes(item.status) ? item.eventDate : null,
    importance_score: item.importanceScore,
    extraction_confidence: item.confidence,
    parser_version: "legistar-v1",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await database
    .from("decision_candidates")
    .upsert(candidate, { onConflict: "source_key,external_item_id" })
    .select("id,matched_decision_id,review_status")
    .single();

  if (error) throw error;

  // Auto-publishing follows review; it never turns a pending candidate into public data.
  const shouldPublish =
    process.env.AUTO_PUBLISH_INGESTION === "true" && data.review_status === "approved";
  if (!shouldPublish) return;

  await publishCandidate(database, source, item, data.id);
}

async function publishCandidate(
  database: SupabaseClient,
  source: SourceConfig,
  item: NormalizedItem,
  candidateId: string,
) {
  const now = new Date().toISOString();
  const completed = ["Approved", "Rejected"].includes(item.status);
  const approvedAt = completed ? `${item.eventDate}T12:00:00Z` : null;

  const { data: existing } = await database
    .from("decisions")
    .select("published_at,approved_at")
    .eq("ingestion_source_key", source.key)
    .eq("external_key", item.externalId)
    .maybeSingle();

  const decision = {
    slug: `${source.organization}-${item.externalId}-${slugify(item.title)}`,
    title: item.title,
    organization: item.organization,
    topic: item.topic,
    status: item.status,
    summary: item.body || item.title,
    why_it_matters:
      "This item was identified as a substantive action in an official government meeting record.",
    latest_update: item.actionText || `${item.status} as of ${item.eventDate}.`,
    next_step:
      item.status === "Scheduled for vote"
        ? `Scheduled government action on ${item.eventDate}.`
        : null,
    published_at: existing?.published_at || now,
    updated_at: now,
    approved_at: approvedAt || existing?.approved_at || null,
    last_checked_at: now,
    affected_roles: [],
    affected_zip_codes: [],
    affected_areas: [],
    important_dates: [{ date: item.eventDate, label: item.status }],
    is_published: true,
    external_key: item.externalId,
    ingestion_source_key: source.key,
    importance_score: item.importanceScore,
    extraction_confidence: item.confidence,
  };

  const { data: saved, error: saveError } = await database
    .from("decisions")
    .upsert(decision, { onConflict: "ingestion_source_key,external_key" })
    .select("id")
    .single();

  if (saveError) throw saveError;

  const { data: officialSource } = await database
    .from("sources")
    .upsert(
      {
        decision_id: saved.id,
        title: `${source.name} official record`,
        organization: source.name,
        url: item.url,
        published_at: item.eventDate,
        last_verified_at: now,
        verification_status: "verified",
      },
      { onConflict: "decision_id,url" },
    )
    .select("id")
    .single();

  const timelineKey = `${source.key}:${item.externalId}:${item.status}`;

  await database
    .from("timeline_events")
    .update({ state: "completed" })
    .eq("decision_id", saved.id)
    .eq("state", "current")
    .neq("external_key", timelineKey);

  await database.from("timeline_events").upsert(
    {
      decision_id: saved.id,
      date: item.eventDate,
      stage: item.status,
      title: item.actionText || item.status,
      description: item.body || item.title,
      what_changed: `Official record is currently ${item.status}.`,
      state: completed ? "completed" : "current",
      source_id: officialSource?.id,
      verification_status: "verified",
      external_key: timelineKey,
    },
    { onConflict: "external_key" },
  );

  await database
    .from("decision_candidates")
    .update({ matched_decision_id: saved.id, review_status: "approved" })
    .eq("id", candidateId);
}
