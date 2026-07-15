import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CivicSource, Decision, ImportantDate, TimelineEvent, UserRole } from "@/types";

type Row = Record<string, unknown> & { sources?: Record<string, unknown>[]; timeline_events?: Record<string, unknown>[] };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

function mapSource(row: Record<string, unknown>): CivicSource {
  return { id:text(row.id), decisionId:text(row.decision_id), title:text(row.title), organization:text(row.organization), url:text(row.url), publishedAt:text(row.published_at) || undefined, pageReference:text(row.page_reference) || undefined, lastVerifiedAt:text(row.last_verified_at), verificationStatus:(text(row.verification_status,"unconfirmed") as CivicSource["verificationStatus"]) };
}

function mapEvent(row: Record<string, unknown>): TimelineEvent {
  return { id:text(row.id), decisionId:text(row.decision_id), date:text(row.date), stage:text(row.stage) as TimelineEvent["stage"], title:text(row.title), description:text(row.description), whatChanged:text(row.what_changed) || undefined, state:text(row.state,"current") as TimelineEvent["state"], sourceId:text(row.source_id) || undefined, verificationStatus:text(row.verification_status,"unconfirmed") as TimelineEvent["verificationStatus"] };
}

function mapDecision(row: Row): Decision {
  return {
    id:text(row.id), slug:text(row.slug), title:text(row.title), organization:text(row.organization) as Decision["organization"], topic:text(row.topic), status:text(row.status) as Decision["status"], summary:text(row.summary), whyItMatters:text(row.why_it_matters), latestUpdate:text(row.latest_update), nextStep:text(row.next_step) || null,
    publishedAt:text(row.published_at), updatedAt:text(row.updated_at), approvedAt:text(row.approved_at) || null, archivedAt:text(row.archived_at) || null, lastCheckedAt:text(row.last_checked_at) || null,
    affectedRoles:(row.affected_roles as UserRole[]) || [], affectedZipCodes:(row.affected_zip_codes as string[]) || [], affectedAreas:(row.affected_areas as string[]) || [], importantDates:(row.important_dates as ImportantDate[]) || [], beforeText:text(row.before_text) || undefined, afterText:text(row.after_text) || undefined, isPublished:Boolean(row.is_published),
    sources:(row.sources || []).map(mapSource), timeline:(row.timeline_events || []).map(mapEvent).sort((a,b)=>a.date.localeCompare(b.date)),
  };
}

const selection = "*, sources(*), timeline_events(*)";

async function localDecisions():Promise<Decision[]>{try{return JSON.parse(await readFile(resolve(process.cwd(),".civiclens/local-decisions.json"),"utf8")) as Decision[]}catch{return[]}}

export async function getDecisions(options: { includeArchived?: boolean; limit?: number } = {}): Promise<Decision[]> {
  const supabase = client();
  if (!supabase) return localDecisions();
  let query = supabase.from("decisions").select(selection).eq("is_published", true).order("updated_at", { ascending:false }).limit(options.limit || 250);
  if (!options.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) { console.error("Unable to load CivicLens decisions", error.message); return []; }
  const mapped=(data as Row[]).map(mapDecision);
  if(options.includeArchived)return mapped;
  const counts=new Map<string,number>();
  return mapped.filter(decision=>{const count=counts.get(decision.organization)||0;if(count>=50)return false;counts.set(decision.organization,count+1);return true});
}

export async function getDecision(slugOrId: string): Promise<Decision | null> {
  const supabase = client();
  if (!supabase) return (await localDecisions()).find(decision=>decision.slug===slugOrId||decision.id===slugOrId)||null;
  const field=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(slugOrId)?"id":"slug";
  const { data, error } = await supabase.from("decisions").select(selection).eq("is_published", true).eq(field,slugOrId).maybeSingle();
  if (error || !data) return null;
  return mapDecision(data as Row);
}
