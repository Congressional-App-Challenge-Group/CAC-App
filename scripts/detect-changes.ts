import { rm } from "node:fs/promises";
import {
  SNAPSHOT_MODEL,
  diffSnapshots,
  holdBackPipelineResolutions,
  toSnapshot,
  type PipelineResolution,
  type Snapshot,
} from "../src/lib/changes";
import type { Decision, DecisionChange } from "../src/types";
import { cachePath, readJson, report, serviceClient, writeJson } from "./shared";

/**
 * Change detection.
 *
 * Diffs the current record set against the previous snapshot and records what
 * actually moved. This is the engine behind "what changed", the notification
 * digests, and any future "follow this" delivery.
 *
 * The first run establishes a baseline and correctly reports no changes.
 */

async function main() {
  const decisions = await readJson<Decision[]>("local-decisions.json");
  if (!decisions?.length) {
    report("Change detection", ["No .civiclens/local-decisions.json found — run `pnpm ingest:local` first."]);
    return;
  }

  const previous = await readJson<Snapshot>("snapshots/latest.json");
  const lines: string[] = [];

  /*
   * A snapshot from a different record model is a new baseline, not a diff.
   *
   * Collapsing agenda appearances into matters re-identifies most of the record
   * set at once. Diffing across that boundary reports the restructuring itself —
   * every merged timeline looks like sudden movement — which would open the
   * feed with noise from our own bookkeeping. Nothing the government did changed,
   * so nothing is reported, and the snapshot is re-taken in the current model.
   */
  if (!previous || previous.model !== SNAPSHOT_MODEL) {
    lines.push(
      `Baseline established for ${decisions.length} records.`,
      "No changes reported on a first run — a first appearance is a",
      "publication, not a movement.",
    );
    if (previous) {
      lines.push(
        "",
        `Previous snapshot used record model "${previous.model ?? "agenda-appearances"}";`,
        `this run uses "${SNAPSHOT_MODEL}". The record set was restructured, so`,
        "diffing across the boundary would report our own re-counting as news.",
      );
    }
    await writeJson("snapshots/latest.json", toSnapshot(decisions));
    // The baseline already contains any pipeline resolution, so the marker is
    // obsolete once it has been absorbed.
    await rm(cachePath("resolution.json"), { force: true });
    // Write the artifact even when empty, so a fresh install has a valid (empty)
    // change log rather than a missing file that looks like a failure.
    await writeJson("changes.json", []);
    report("Change detection", lines);
    return;
  }

  /*
   * A dataset upgrade is not public movement.
   *
   * When matter resolution fills in hundreds of previously blank outcomes, every
   * one of those records genuinely differs from the last snapshot — but the
   * government did not decide anything new. Reporting that as hundreds of
   * "changes" would make the movement feed meaningless, so the pipeline marks
   * what it rewrote and those specific records are held back. The snapshot still
   * advances, so the resolution is absorbed rather than re-reported forever.
   */
  const marker = await readJson<PipelineResolution>("resolution.json");
  const { changes, heldBack } = holdBackPipelineResolutions(
    diffSnapshots(previous, decisions),
    marker,
  );

  const archive = (await readJson<DecisionChange[]>("changes.json")) ?? [];
  const seen = new Set(archive.map((change) => change.id));
  const merged = [...changes.filter((change) => !seen.has(change.id)), ...archive].slice(0, 2000);

  await writeJson("changes.json", merged);
  await writeJson("snapshots/latest.json", toSnapshot(decisions));

  lines.push(
    `Compared against snapshot from ${previous.capturedAt}.`,
    `New changes detected: ${changes.length}`,
    `Total changes on file: ${merged.length}`,
  );

  if (marker) {
    lines.push(
      `Held back as dataset upgrade (${marker.reason}): ${heldBack.length}`,
      `  ${marker.entries.length} records were re-resolved by the pipeline, not by a government action.`,
      "  Held back per field, so unrelated movement on those records still reports.",
    );
    // Consumed: the snapshot has advanced, so this never suppresses again.
    await rm(cachePath("resolution.json"), { force: true });
  }

  const byField = new Map<string, number>();
  for (const change of changes) byField.set(change.field, (byField.get(change.field) || 0) + 1);
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${field}: ${count}`);
  }

  const supabase = serviceClient();
  if (supabase && changes.length) {
    const rows = changes.map((change) => ({
      id: change.id,
      decision_id: change.decisionId,
      field: change.field,
      previous_value: change.previous,
      current_value: change.current,
      changed_at: change.changedAt,
      source_url: change.sourceUrl ?? null,
    }));
    const { error } = await supabase.from("decision_changes").upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: true,
    });
    lines.push(error ? `Supabase push failed: ${error.message}` : `Pushed ${rows.length} changes to Supabase.`);
  } else if (!supabase) {
    lines.push("Supabase credentials absent — cache updated only.");
  }

  report("Change detection", lines);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
