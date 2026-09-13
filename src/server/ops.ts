import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { govSources } from "@/lib/sources";

export type SourceHealth = {
  key: string;
  name: string;
  status: "completed" | "failed" | "running" | "never";
  finishedAt: string | null;
  documentsFound: number;
  documentsChanged: number;
  candidatesFound: number;
  errorMessage: string | null;
  stale: boolean;
};

const STALE_HOURS = 36;

/**
 * Ingestion health.
 *
 * The pipeline runs unattended, so a stalled or failing source previously went
 * unnoticed. This surfaces the last run per source so failure is loud.
 * Requires the service role because `ingestion_runs` has RLS enabled with no
 * public policy.
 */
export async function getIngestionHealth(): Promise<SourceHealth[]> {
  const service = createSupabaseServiceClient();
  const base: SourceHealth[] = govSources.map((source) => ({
    key: source.key,
    name: source.name,
    status: "never",
    finishedAt: null,
    documentsFound: 0,
    documentsChanged: 0,
    candidatesFound: 0,
    errorMessage: null,
    stale: true,
  }));

  if (!service) return base;

  const { data, error } = await service
    .from("ingestion_runs")
    .select("source_key,status,finished_at,documents_found,documents_changed,candidates_found,error_message")
    .order("started_at", { ascending: false })
    .limit(60);

  if (error || !data) return base;

  const latest = new Map<string, Record<string, unknown>>();
  for (const row of data as unknown as Record<string, unknown>[]) {
    const key = String(row.source_key);
    if (!latest.has(key)) latest.set(key, row);
  }

  return base.map((entry) => {
    const row = latest.get(entry.key);
    if (!row) return entry;
    const finishedAt = typeof row.finished_at === "string" ? row.finished_at : null;
    const ageHours = finishedAt ? (Date.now() - new Date(finishedAt).getTime()) / 3_600_000 : Infinity;
    return {
      ...entry,
      status: (row.status as SourceHealth["status"]) ?? "never",
      finishedAt,
      documentsFound: Number(row.documents_found ?? 0),
      documentsChanged: Number(row.documents_changed ?? 0),
      candidatesFound: Number(row.candidates_found ?? 0),
      errorMessage: typeof row.error_message === "string" ? row.error_message : null,
      stale: ageHours > STALE_HOURS,
    };
  });
}
