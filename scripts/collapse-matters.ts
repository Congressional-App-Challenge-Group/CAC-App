import { collapseToMatters, reconcileArtifacts, type ExcludedEntity } from "../src/lib/matter";
import type { Decision } from "../src/types";
import { readJson, report, writeJson } from "./shared";

/**
 * Collapse agenda appearances into matters.
 *
 * This is the step that decides what counts as one thing the government is
 * doing. It exists because Charlotte's Legistar assigns a fresh matter id to
 * every agenda appearance of the same rezoning petition, so the tracker was
 * counting one rezoning once per meeting it touched — and could never report an
 * outcome for it, because an agenda item does not state one.
 *
 * Two things happen here, and they are different in kind:
 *
 *   - **Merging** fixes counting. Nothing is lost: the appearances become events
 *     on the matter's timeline, and every official source stays attached.
 *   - **Exclusion** is a judgement — a meeting notice is not a decision — so it
 *     is reported and written to `.civiclens/excluded.json` rather than performed
 *     silently. A number nobody can audit is not an honest one.
 *
 * Retired slugs are written to `.civiclens/slug-aliases.json` so links already
 * shared keep resolving instead of 404ing.
 *
 * Both side artifacts accumulate: this step is safe to run twice, and running it
 * on its own output preserves the aliases and the audit trail recorded earlier.
 */

async function main() {
  const decisions = await readJson<Decision[]>("local-decisions.json");
  if (!decisions?.length) {
    report("Matter collapse", [
      "No .civiclens/local-decisions.json found — run `pnpm ingest:local` first.",
    ]);
    return;
  }

  const alreadyCollapsed = decisions.every((decision) => decision.matterKey);
  const { matters, excluded, aliases } = collapseToMatters(decisions);

  /*
   * Fold this run into what is already on disk rather than replacing it.
   *
   * Running the pipeline regenerates the dataset from source each time, so a
   * later run legitimately covers more history than an earlier one. A collapse
   * over its own output covers exactly as much — which is why the two are folded
   * together instead of the newer file simply winning.
   */
  const artifacts = reconcileArtifacts({
    previousAliases: (await readJson<Record<string, string>>("slug-aliases.json")) ?? {},
    previousExcluded: (await readJson<ExcludedEntity[]>("excluded.json")) ?? [],
    aliases,
    excluded,
    matters,
  });

  await writeJson("local-decisions.json", matters);
  await writeJson("excluded.json", artifacts.excluded);
  await writeJson("slug-aliases.json", artifacts.aliases);

  // How many source rows collapsed, and which shared identities did the work.
  const merged = decisions.length - excluded.length - matters.length;
  const byKeyType = new Map<string, number>();
  for (const matter of matters) {
    const kind = matter.matterKey?.split(":")[0] ?? "unknown";
    byKeyType.set(kind, (byKeyType.get(kind) ?? 0) + 1);
  }

  const repeated = matters
    .filter((matter) => (matter.appearanceCount ?? 1) > 1)
    .sort((a, b) => (b.appearanceCount ?? 0) - (a.appearanceCount ?? 0));

  report("Matter collapse", [
    `Source records:          ${decisions.length}`,
    `Matters published:       ${matters.length}`,
    `Appearances merged away: ${merged}`,
    `Meeting notices set aside: ${excluded.length}`,
    "",
    ...["petition", "matter", "title"].map(
      (kind) => `Identified by ${kind}:    ${byKeyType.get(kind) ?? 0}`,
    ),
    "",
    ...(repeated.length
      ? [
          `Most-repeated matters (merged into one record each):`,
          ...repeated.slice(0, 3).map(
            (matter) =>
              `  ${matter.appearanceCount}x  ${matter.title.slice(0, 62)}`,
          ),
        ]
      : ["No matter appeared more than once."]),
    "",
    alreadyCollapsed
      ? "Input was already collapsed: matters are unchanged and the artifacts on" +
          " file were carried forward rather than recomputed."
      : "",
    artifacts.excluded.length
      ? `Set-aside notices are listed in .civiclens/excluded.json (${artifacts.excluded.length} rows` +
          (artifacts.excluded.length !== excluded.length
            ? `, ${excluded.length} observed this run`
            : "") +
          ")."
      : "Nothing was set aside.",
    Object.keys(artifacts.aliases).length
      ? `${Object.keys(artifacts.aliases).length} retired slug(s) redirect to their surviving record` +
          (Object.keys(artifacts.aliases).length !== Object.keys(aliases).length
            ? ` (${Object.keys(aliases).length} retired this run)`
            : "") +
          "."
      : "No slug was retired.",
  ].filter(Boolean));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export type { ExcludedEntity };
