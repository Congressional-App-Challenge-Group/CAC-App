import { generateDrafts, needsPlainLanguage, PROMPT_VERSION } from "../src/lib/enrichment";
import type { Decision } from "../src/types";
import { readJson, report, serviceClient, writeJson, type Dict } from "./shared";

/**
 * Plain-language drafting.
 *
 * Produces *pending* drafts only. Nothing here is published: an editor must
 * approve each draft before it can appear on a public page. Re-running the job
 * after a prompt change creates a new set of drafts rather than overwriting
 * reviewed work.
 */

const LIMIT = Number(process.env.ENRICHMENT_LIMIT || 60);

async function main() {
  const decisions = await readJson<Decision[]>("local-decisions.json");
  if (!decisions?.length) {
    report("Plain-language drafts", ["No .civiclens/local-decisions.json found — run `pnpm ingest:local` first."]);
    return;
  }

  const existing = (await readJson<Array<Dict & { decisionId: string; field: string; promptVersion: string }>>(
    "drafts.json",
  )) ?? [];
  const alreadyDrafted = new Set(existing.map((draft) => `${draft.decisionId}:${draft.field}:${draft.promptVersion}`));

  const targets = decisions.filter(needsPlainLanguage).slice(0, LIMIT);
  const fresh: Dict[] = [];
  let model = "civiclens-template";

  for (const decision of targets) {
    const drafts = await generateDrafts(decision);
    for (const draft of drafts) {
      const key = `${draft.decisionId}:${draft.field}:${draft.promptVersion}`;
      if (alreadyDrafted.has(key)) continue;
      fresh.push({
        id: `${draft.decisionId}:${draft.field}:${PROMPT_VERSION}`,
        decisionId: draft.decisionId,
        field: draft.field,
        draftText: draft.draftText,
        model: draft.model,
        promptVersion: draft.promptVersion,
        sourceExcerpts: draft.sourceExcerpts,
        status: "pending",
        editorId: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
      });
      model = draft.model;
    }
  }

  const merged = [...existing, ...fresh];
  await writeJson("drafts.json", merged);

  const lines = [
    `Records still needing plain language: ${decisions.filter(needsPlainLanguage).length}`,
    `Drafted this run: ${fresh.length} (${targets.length} records, model: ${model})`,
    `Total drafts on file: ${merged.length}`,
    `Pending review: ${merged.filter((draft) => draft.status === "pending").length}`,
    "",
    "Drafts are pending by default — approve them in /admin/drafts before they",
    "can appear on a public page.",
  ];

  const supabase = serviceClient();
  if (supabase && fresh.length) {
    const { error } = await supabase.from("decision_drafts").upsert(fresh, {
      onConflict: "decision_id,field,prompt_version",
      ignoreDuplicates: true,
    });
    lines.push(error ? `Supabase push failed: ${error.message}` : `Pushed ${fresh.length} drafts to Supabase.`);
  } else if (!supabase) {
    lines.push("Supabase credentials absent — cache updated only.");
  }

  report("Plain-language drafts", lines);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
