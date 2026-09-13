import { diffSnapshots, toSnapshot, type Snapshot } from "../src/lib/changes";
import type { Decision, DecisionChange } from "../src/types";
import { readJson, report, serviceClient, writeJson } from "./shared";

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

  if (!previous) {
    lines.push(
      `Baseline established for ${decisions.length} records.`,
      "No changes reported on a first run — a first appearance is a",
      "publication, not a movement.",
    );
    await writeJson("snapshots/latest.json", toSnapshot(decisions));
    // Write the artifact even when empty, so a fresh install has a valid (empty)
    // change log rather than a missing file that looks like a failure.
    await writeJson("changes.json", []);
    report("Change detection", lines);
    return;
  }

  const changes = diffSnapshots(previous, decisions);

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
