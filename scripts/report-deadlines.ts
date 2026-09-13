import { buildDisclosureReport, gapPercent } from "../src/lib/disclosure";
import { formatDeadlineDate, upcomingActions } from "../src/lib/deadlines";
import { orgNames } from "../src/lib/civic";
import type { Decision } from "../src/types";
import { readJson, report } from "./shared";

/**
 * Deadline and disclosure report.
 *
 * Prints the two claims the product makes, from the dataset on disk, so they can
 * be checked without opening the site. Useful for verifying a pipeline run and
 * for quoting exact figures in a demo.
 */

async function main() {
  const decisions = await readJson<Decision[]>("local-decisions.json");
  if (!decisions?.length) {
    report("Deadline report", [
      "No .civiclens/local-decisions.json found — run `pnpm ingest:local` first.",
    ]);
    return;
  }

  const now = new Date();
  const upcoming = upcomingActions(decisions, { now });

  const lines: string[] = [`Generated ${now.toISOString()}`, ""];

  if (upcoming.length) {
    lines.push(`${upcoming.length} tracked items have a published date for their next action:`);
    lines.push("");

    const byDay = new Map<string, typeof upcoming>();
    for (const item of upcoming) {
      const bucket = byDay.get(item.deadline.date!);
      if (bucket) bucket.push(item);
      else byDay.set(item.deadline.date!, [item]);
    }

    for (const [date, items] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`  ${formatDeadlineDate(date)} — ${items.length} item(s)`);
      for (const item of items.slice(0, 4)) {
        lines.push(
          `    · ${item.decision.title.slice(0, 72)}`,
          `      ${orgNames[item.decision.organization]}${
            item.decision.requester ? ` · ${item.decision.requester}` : ""
          } · ${item.decision.status} · ${item.countdown}`,
        );
      }
      if (items.length > 4) lines.push(`    … and ${items.length - 4} more`);
    }
  } else {
    lines.push(
      "No tracked item currently has a published date for its next action.",
      "This is expected on a first run: dates appear as governments publish agendas.",
    );
  }

  report("Upcoming decisions", lines);

  const disclosure = buildDisclosureReport(decisions, { now });
  const gapLines: string[] = [disclosure.scopeStatement, ""];

  for (const gap of [...disclosure.gaps].sort((a, b) => b.share - a.share)) {
    gapLines.push(
      `  ${String(gapPercent(gap)).padStart(3)}%  ${gap.missingLabel} (${gap.missing} of ${gap.total})`,
    );
  }

  gapLines.push(
    "",
    `  Still "Under review" with no outcome: ${disclosure.stuck.count} of ${disclosure.open} open items`,
    `  Never recorded a second action:        ${disclosure.singleEvent.count} of ${disclosure.total}`,
    `  Confirmed location:                    ${disclosure.located} of ${disclosure.total}`,
    `  Published action date:                 ${disclosure.scheduled} of ${disclosure.total}`,
  );

  report("Disclosure gap", gapLines);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
