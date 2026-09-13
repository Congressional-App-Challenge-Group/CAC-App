import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getDecision } from "@/server/decisions";
import { generateDrafts } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

type Body = {
  action?: "generate" | "approve" | "reject";
  id?: string;
  decisionId?: string;
};

/**
 * Editorial review endpoint.
 *
 * This is the only path by which generated text can become public: a signed-in
 * editor must explicitly approve a draft. Generation itself never publishes.
 */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!current.role) return NextResponse.json({ error: "Editor role required." }, { status: 403 });

  const service = createSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Service role is not configured." }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "generate") {
    const decisionId = body.decisionId;
    if (!decisionId) return NextResponse.json({ error: "decisionId is required." }, { status: 400 });

    const decision = await getDecision(decisionId);
    if (!decision) return NextResponse.json({ error: "Decision not found." }, { status: 404 });

    const drafts = await generateDrafts(decision);
    if (!drafts.length) {
      return NextResponse.json({ ok: true, created: 0, note: "Nothing to draft for this record." });
    }

    const rows = drafts.map((draft) => ({
      decision_id: draft.decisionId,
      field: draft.field,
      draft_text: draft.draftText,
      model: draft.model,
      prompt_version: draft.promptVersion,
      source_excerpts: draft.sourceExcerpts,
      status: "pending" as const,
    }));

    const { error } = await service
      .from("decision_drafts")
      .upsert(rows, { onConflict: "decision_id,field,prompt_version", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, created: rows.length, model: drafts[0]?.model });
  }

  if (body.action === "approve" || body.action === "reject") {
    if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { error } = await service
      .from("decision_drafts")
      .update({
        status: body.action === "approve" ? "approved" : "rejected",
        editor_id: current.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", body.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
