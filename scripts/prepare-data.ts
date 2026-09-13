import { execFileSync } from "node:child_process";
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
const MAX_AGE_HOURS = Number(process.env.DATA_MAX_AGE_HOURS || 20);
const MAX_AGE_MS = MAX_AGE_HOURS * 3_600_000;

type Step = { label: string; script: string; required: boolean };

// Plain-language drafting is deliberately excluded: it can call a paid model
// and is a scheduled editorial job, not a build step.
const STEPS: Step[] = [
  { label: "ingest:local", script: "scripts/ingest-local.ts", required: true },
  { label: "enrich:geography", script: "scripts/enrich-geography.ts", required: false },
  { label: "detect-changes", script: "scripts/detect-changes.ts", required: false },
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

  for (const step of STEPS) {
    try {
      execFileSync(process.execPath, ["--import", "tsx", step.script], {
        stdio: "inherit",
        env: process.env,
      });
      notes.push(`${step.label}: ok`);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "unknown error";
      notes.push(`${step.label}: failed (${message})`);
    }
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
  report("Data preparation", notes);
}

main();
