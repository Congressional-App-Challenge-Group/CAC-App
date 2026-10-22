import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { report } from "./shared";

/**
 * Build-time data preparation for the static deployment mode.
 *
 * The public site can run entirely from `.civiclens/local-decisions.json` when
 * Supabase is not configured. That file is gitignored, so a fresh clone — and
 * therefore every CI/Vercel build — starts without it. This script regenerates
 * it on demand and bundles the result with the deployment.
 *
 * Design rules:
 *   - It never fails the build. A transient upstream outage should not block a
 *     release; it should produce a loud warning instead of a silent empty site.
 *   - It skips work when the cache is already fresh, so rebuilds stay fast.
 *   - Network fetches stay out of `next build` itself, which keeps Next's build
 *     deterministic while still guaranteeing the data exists.
 *
 * Set FORCE_DATA_REFRESH=true to bypass the freshness check.
 * Set DATA_MAX_AGE_HOURS to change the staleness window (default 20).
 */

const CACHE = resolve(process.cwd(), ".civiclens", "local-decisions.json");
const MAX_AGE_HOURS = Number(process.env.DATA_MAX_AGE_HOURS || 4); // Reduced from 20 to 4 hours for more frequent updates
const MAX_AGE_MS = MAX_AGE_HOURS * 3_600_000;

type Step = { label: string; script: string; required: boolean; env?: Record<string, string> };

/**
 * Build-time drafting is the deterministic template path, never the model.
 *
 * An empty key makes `generateDrafts` fall back to the templates it can prove
 * from the record's own words, so a build cannot spend money or publish a
 * model's phrasing that no one has read. The approval gate after it refuses
 * rather than repairs, which is what keeps this a review instead of a formality.
 */
const TEMPLATE_ONLY = {
  ENRICHMENT_API_KEY: "",
  // The drafting job defaults to 60 records, which would leave most of the set
  // without a rewrite on a fresh build.
  ENRICHMENT_LIMIT: "100000",
};

const STEPS: Step[] = [
  { label: "ingest:local", script: "scripts/ingest-local.ts", required: true },
  // Collapse before matter resolution, so the register join runs once per matter
  // instead of once per agenda appearance of it.
  { label: "collapse:matters", script: "scripts/collapse-matters.ts", required: false },
  { label: "enrich:matters", script: "scripts/enrich-matters.ts", required: false },
  { label: "enrich:geography", script: "scripts/enrich-geography.ts", required: false },
  // Order matters: change detection must run after matter resolution so the
  // pipeline's own re-resolving is absorbed instead of reported as movement.
  { label: "detect-changes", script: "scripts/detect-changes.ts", required: false },
  /*
   * Plain language, drafted then reviewed.
   *
   * These are here rather than left to a scheduled job because a fresh clone has
   * no drafts at all, so a deploy that skipped them would publish every record in
   * the agency's own wording while the interface still said "rewritten in plain
   * language", with nothing to show that anything was missing. Both steps are
   * deterministic and take seconds with the model disabled.
   */
  { label: "enrich:language", script: "scripts/enrich-plain-language.ts", required: false, env: TEMPLATE_ONLY },
  { label: "approve:drafts", script: "scripts/approve-drafts.ts", required: false, env: TEMPLATE_ONLY },
];

function countRecords(file: string): number {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function main() {
  const notes: string[] = [];

  if (existsSync(CACHE) && process.env.FORCE_DATA_REFRESH !== "true") {
    const ageMs = Date.now() - statSync(CACHE).mtimeMs;
    const records = countRecords(CACHE);
    if (ageMs < MAX_AGE_MS && records > 0) {
      report("Data preparation", [
        `Cache is fresh (${Math.round(ageMs / 3_600_000)}h old, ${records} records). Skipping refresh.`,
        "Set FORCE_DATA_REFRESH=true to refresh anyway.",
      ]);
      return;
    }
    notes.push(
      ageMs >= MAX_AGE_MS
        ? `Cache is stale (${Math.round(ageMs / 3_600_000)}h old). Refreshing.`
        : "Cache exists but contains no records. Refreshing.",
    );
  } else {
    notes.push("No cached dataset found. Building one.");
  }

  const failures: string[] = [];

  for (const step of STEPS) {
    // stdout and stderr are captured rather than inherited so a failure can be
    // quoted back in full. A step that dies leaves the dataset in the previous
    // step's state, which looks fine at a glance — so the reason must survive
    // into the summary instead of scrolling past above it.
    const run = spawnSync(process.execPath, ["--import", "tsx", step.script], {
      encoding: "utf8",
      env: step.env ? { ...process.env, ...step.env } : process.env,
    });
    if (run.stdout) process.stdout.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);

    if (run.status === 0) {
      notes.push(`${step.label}: ok`);
      continue;
    }

    const detail = (run.stderr || run.stdout || "no output")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-4);
    notes.push(`${step.label}: FAILED`, ...detail.map((line) => `    ${line}`));
    failures.push(step.label);
  }

  const records = existsSync(CACHE) ? countRecords(CACHE) : 0;

  if (records === 0) {
    notes.push(
      "",
      "WARNING: no dataset is available. If Supabase is configured the site will",
      "read from it instead and this is harmless. If it is not configured, every",
      "public page will render empty.",
    );
    report("Data preparation", notes);
    // Deliberately exit 0: never block a release on an upstream outage.
    return;
  }

  notes.push("", `Dataset ready: ${records} records.`);

  if (failures.length) {
    /*
     * A failed step is reported, never thrown.
     *
     * Blocking the release on a transient upstream outage would be worse than
     * deploying the previous dataset, but the two must not look alike: the site
     * renders identically either way, so the only signal a reader gets is this
     * banner. Derived steps are called out separately because their failure
     * leaves the *unit of measurement* wrong rather than leaving it empty — the
     * record count stays plausible while quietly counting the wrong thing.
     */
    const derived = STEPS.filter(
      (step) => !step.required && failures.includes(step.label),
    ).map((step) => step.label);
    notes.push(
      "",
      `WARNING: ${failures.length} pipeline step(s) failed: ${failures.join(", ")}.`,
      ...(derived.length
        ? [
            `  Derived steps (${derived.join(", ")}) build on the ingested records.`,
            "  With them skipped the dataset may still load, but its counts and",
            "  identities are those of the previous step — not the corrected ones.",
          ]
        : []),
      "  The release proceeds with whatever dataset exists, as designed.",
    );
  }

  report("Data preparation", notes);
}

main();
