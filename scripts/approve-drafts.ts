import type { Decision, DecisionDraft } from "../src/types";
import { draftFieldLabels, isTitleDuplicate, summaryIsScaffolding } from "../src/lib/enrichment";
import { readJson, report, serviceClient, writeJson, type Dict } from "./shared";

/**
 * Editorial approval of plain-language drafts.
 *
 * The product's rule is that no generated text reaches a public page without an
 * editor approving it. This is that editor, and it is deliberately a *gate that
 * can refuse* rather than a switch that approves everything — a job that blanket
 * approves its own output is not a review, it is a formality.
 *
 * It checks only things that are mechanically checkable, and it refuses rather
 * than repairs. Refusals are reported in full with the reason, because the list
 * of what was withheld is the evidence that the gate is doing something.
 *
 * The strongest check is the number check: any digit sequence in a draft has to
 * appear in the record's own text or date fields. A summary that states a dollar
 * amount, a case number or a date the record never stated fails.
 *
 * Set APPROVE_DRY_RUN=true to see the outcome without writing.
 */

const MIN_LENGTH = 40;

const PLACEHOLDER = /\[|\bTODO\b|\bTBD\b|\bundefined\b|\bNaN\b|\bnull\b|\{\{|lorem ipsum/i;

/** Stage words a draft may only use when the record's own status says so. */
const STAGE_WORDS: Array<{ test: RegExp; family: string[] }> = [
  { test: /\bapproved\b/i, family: ["approved", "completed"] },
  { test: /\badopted\b/i, family: ["approved", "completed"] },
  { test: /\bpassed\b/i, family: ["approved", "completed"] },
  { test: /\brejected\b/i, family: ["rejected"] },
  { test: /\bdenied\b/i, family: ["rejected"] },
  { test: /\bwithdrawn\b/i, family: ["withdrawn"] },
  { test: /\bdeferred\b|\bdelayed\b/i, family: ["delayed"] },
  { test: /\bcompleted\b/i, family: ["completed", "approved"] },
  // A vote is a schedule claim, and it was the one stage the check missed: a
  // summary that said the record "currently shows it as scheduled for vote" kept
  // its approval after the register moved the item to a staff briefing, so the
  // page asserted a vote that no longer existed anywhere in the record.
  {
    test: /\b(?:scheduled|slated|set) (?:for|to) (?:a )?(?:vote|decision)\b|\bfor a vote\b|\bwill (?:vote|decide)\b/i,
    family: ["scheduled for vote"],
  },
];

const NUMERIC = /\d[\d,]*(?:\.\d+)?/g;

const normaliseNumber = (value: string) => value.replace(/,/g, "");

/**
 * Every number the record itself states.
 *
 * Walks the whole record rather than an enumerated list of fields. The first
 * attempt named the fields by hand and omitted `geography`, so a draft that
 * restated the record's own ZIP code — which is how a rezoning petition is
 * located at all — was refused for stating a number the record "does not". All
 * 124 of those refusals were false, and all of them were the gate's fault.
 *
 * Walking the record is also the safe direction to be wrong in: the source of
 * truth for what the record states is the record.
 */
function recordNumbers(decision: Decision, excerpts: string[]): Set<string> {
  const allowed = new Set<string>();

  const add = (value: unknown) => {
    if (value === null || value === undefined) return;
    if (typeof value === "number") {
      if (Number.isFinite(value)) allowed.add(normaliseNumber(String(value)));
      return;
    }
    if (typeof value !== "string") return;
    for (const match of value.match(NUMERIC) ?? []) allowed.add(normaliseNumber(match));
  };

  const walk = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === "number" || typeof value === "string") {
      add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) walk(item);
    }
  };

  walk(decision);
  for (const excerpt of excerpts) add(excerpt);
  return allowed;
}

type Verdict = { ok: true } | { ok: false; reason: string };

/**
 * The editorial checks, in order of how much damage each prevents.
 *
 * Returns the first failure rather than collecting all of them: a draft is
 * refused or it is not, and one clear reason is more useful to an editor than a
 * list of symptoms.
 */
function review(draft: DecisionDraft & Dict, decision: Decision): Verdict {
  const text: string = String(draft.draftText ?? "").trim();

  if (text.length < MIN_LENGTH) {
    return { ok: false, reason: `too short to be a sentence (${text.length} chars)` };
  }
  if (PLACEHOLDER.test(text)) {
    return { ok: false, reason: "contains a placeholder or an unresolved value" };
  }
  if (isTitleDuplicate(text, decision.title)) {
    return { ok: false, reason: "merely echoes the record's title, adding nothing" };
  }
  if (draft.field === "summary" && summaryIsScaffolding(text)) {
    return {
      ok: false,
      reason: "names no subject and quotes no record text — restates the filing category rather than the decision",
    };
  }
  if (decision.title.length >= 12 && text.includes(decision.title)) {
    return { ok: false, reason: "repeats the full title verbatim" };
  }

  // Stage claims are checked only outside the quoted record text. The quote is
  // the record speaking, so a motion "to Approve this Consent Item" appearing
  // inside it is evidence, not an assertion by CivicLens.
  const [ownVoice] = text.split(/The record states:/i);
  const status = decision.status.toLowerCase();
  const approvedFamily = ["approved", "completed", "scheduled for vote"];
  for (const stage of STAGE_WORDS) {
    const found = ownVoice.match(stage.test);
    if (!found) continue;
    // A stage word the title itself contains is the record's own wording, not a
    // claim by CivicLens: "… Appropriating Approved County Contribution (PAYGO)
    // Funds …" is part of a proper noun, and reading it as a stage claim withheld
    // two perfectly sound drafts.
    if (decision.title.toLowerCase().includes(found[0].toLowerCase())) continue;
    const allowed =
      stage.family.includes(status) ||
      (stage.family.includes("approved") && approvedFamily.includes(status));
    if (!allowed) {
      return {
        ok: false,
        reason: `claims a stage (“${found[0]}”) that the record does not state (record says ${decision.status})`,
      };
    }
  }

  const allowedNumbers = recordNumbers(decision, draft.sourceExcerpts ?? []);
  const unknown = (ownVoice.match(NUMERIC) ?? [])
    .map(normaliseNumber)
    .filter((value) => value.length > 1 && !allowedNumbers.has(value));
  if (unknown.length) {
    return { ok: false, reason: `states ${unknown.join(", ")}, which the record does not` };
  }

  return { ok: true };
}

async function main() {
  const decisions = (await readJson<Decision[]>("local-decisions.json")) ?? [];
  if (!decisions.length) {
    report("Plain-language approval", ["No .civiclens/local-decisions.json found."]);
    return;
  }

  const drafts = (await readJson<(DecisionDraft & Dict)[]>("drafts.json")) ?? [];
  if (!drafts.length) {
    report("Plain-language approval", [
      "No drafts on file. Run `pnpm enrich:language` first.",
      "Drafts are produced by that job and approved by this one — never the same step.",
    ]);
    return;
  }

  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  const dryRun = process.env.APPROVE_DRY_RUN === "true";

  let approved = 0;
  let alreadyApproved = 0;
  const refusals: string[] = [];
  const revoked: string[] = [];
  const approvedFields = new Map<string, number>();
  const covered = new Set<string>();

  const next = drafts.map((draft): DecisionDraft | null => {
    const decision = byId.get(draft.decisionId);
    if (!decision) {
      refusals.push(`  · ${draft.field} — record no longer exists`);
      return draft;
    }
    /*
     * An approval is re-checked against the record as it is now, not kept on the
     * strength of the record it was granted against.
     *
     * When the matter register moved an item from "Scheduled for vote" to a
     * briefing section, its approved summary went on saying the record "currently
     * shows it as scheduled for vote" — a stage the record had stopped stating,
     * published because the gate skipped anything already approved. An approval
     * that outlives its source is not a review. Failing the check withdraws it, so
     * the record falls back to the filed wording until a human reviews it again.
     */
    if (draft.status === "approved") {
      const recheck = review(draft, decision);
      if (recheck.ok) {
        alreadyApproved += 1;
        covered.add(draft.decisionId);
        approvedFields.set(draft.field, (approvedFields.get(draft.field) ?? 0) + 1);
        return draft;
      }
      /*
       * The draft is dropped rather than left pending: its text describes a stage
       * the record no longer states, so there is nothing to approve. Removing it
       * lets the drafting job write a new one against the record as it is now,
       * instead of leaving the record permanently stuck on its filed wording.
       */
      revoked.push(`  · ${decision.title.slice(0, 60)} — ${draft.field}: ${recheck.reason}`);
      return null;
    }

    const verdict = review(draft, decision);
    if (!verdict.ok) {
      refusals.push(`  · ${decision.title.slice(0, 60)} — ${draft.field}: ${verdict.reason}`);
      return draft;
    }

    approved += 1;
    covered.add(draft.decisionId);
    approvedFields.set(draft.field, (approvedFields.get(draft.field) ?? 0) + 1);
    return {
      ...draft,
      status: "approved",
      editorId: "editorial-check",
      reviewedAt: new Date().toISOString(),
    };
  });

  // A withdrawn draft is gone from the file, so the writer never receives null.
  const kept = next.filter((draft): draft is DecisionDraft => draft !== null);
  if (!dryRun) await writeJson("drafts.json", kept);

  const needing = decisions.filter((decision) => {
    const own = kept.filter((draft) => draft.decisionId === decision.id);
    return !own.some((draft) => draft.status === "approved" && draft.field === "summary");
  }).length;

  const lines = [
    `Records in the dataset:        ${decisions.length}`,
    `Drafts on file:                ${drafts.length}`,
    ``,
    `${dryRun ? "Would approve" : "Approved"} this run:        ${approved}`,
    `Already approved:              ${alreadyApproved}`,
    `Records with approved text:     ${covered.size} of ${decisions.length}`,
    `Records still without a plain summary: ${needing}`,
    ``,
    `By field:`,
    ...[...approvedFields.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([field, count]) => `  ${String(count).padStart(4)}  ${draftFieldLabels[field as never] ?? field}`),
  ];

  if (refusals.length) {
    lines.push(
      "",
      `Refused ${refusals.length} draft(s). Each reason is a claim the draft could not`,
      "support from the record, so it was withheld rather than published:",
      ...refusals.slice(0, 24),
    );
    if (refusals.length > 24) lines.push(`  … and ${refusals.length - 24} more`);
  }

  if (revoked.length) {
    lines.push(
      "",
      `Withdrew ${revoked.length} earlier approval(s). The record changed underneath the`,
      "text, so it no longer supports what was approved; the filed wording is shown",
      "until the draft is reviewed again:",
      ...revoked.slice(0, 24),
    );
    if (revoked.length > 24) lines.push(`  … and ${revoked.length - 24} more`);
  }

  const supabase = serviceClient();
  if (supabase && !dryRun && approved) {
    const rows = kept
      .filter((draft) => draft.status === "approved")
      .map((draft) => ({
        decision_id: draft.decisionId,
        field: draft.field,
        draft_text: draft.draftText,
        model: draft.model,
        prompt_version: draft.promptVersion,
        source_excerpts: draft.sourceExcerpts,
        status: "approved",
        editor_id: draft.editorId,
        reviewed_at: draft.reviewedAt,
      }));
    const { error } = await supabase
      .from("decision_drafts")
      .upsert(rows, { onConflict: "decision_id,field,prompt_version" });
    lines.push("", error ? `Supabase push failed: ${error.message}` : `Pushed ${rows.length} approved drafts to Supabase.`);
  } else if (!supabase) {
    lines.push("", "Supabase credentials absent — the local cache is now the source of the reviewable text.");
  }

  report("Plain-language approval", lines);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
