import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { slugify } from "@/ingestion/normalize";
import { organizationValues, statusValues, type DecisionStatus } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Editor-gated write endpoint. Verifies the request session and the caller's
 * editorial role via the service role, then persists the decision record and
 * an attached source. Returns 401/403 when the caller isn't authorized.
 */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!current.role) return NextResponse.json({ error: "Editor role required." }, { status: 403 });

  const service = createSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Service role is not configured for writes." }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const organization = (typeof body.organization === "string" && organizationValues.includes(body.organization as never))
    ? (body.organization as "charlotte" | "mecklenburg-county" | "cms")
    : "charlotte";
  const status = (typeof body.status === "string" && statusValues.includes(body.status as never))
    ? (body.status as Exclude<DecisionStatus, never>)
    : "Proposed";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const existingId = typeof body.id === "string" ? body.id : undefined;

  if (title.length < 8 || summary.length < 20) {
    return NextResponse.json({ error: "Title needs at least 8 characters and summary at least 20." }, { status: 400 });
  }

  const slug = existingId ? undefined : slugify(title) || `decision-${Date.now()}`;
  const now = new Date().toISOString();

  const payload = {
    id: existingId,
    slug,
    title,
    organization,
    topic,
    status,
    summary,
    why_it_matters: typeof body.whyItMatters === "string" && body.whyItMatters.trim() ? body.whyItMatters.trim() : summary,
    latest_update: `Recorded by an editor on ${now.slice(0, 10)}.`,
    is_published: true,
    updated_at: now,
  };

  if (existingId) {
    const { error } = await service.from("decisions").update(payload).eq("id", existingId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: existingId });
  }

  const { data, error } = await service.from("decisions").insert(payload).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Insert failed." }, { status: 500 });

  if (sourceUrl) {
    const { error: sourceError } = await service
      .from("sources")
      .insert({
        decision_id: data.id,
        title: `${organization} editorial record`,
        organization,
        url: sourceUrl,
        last_verified_at: now,
        verification_status: "verified",
      });
    if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, slug });
}