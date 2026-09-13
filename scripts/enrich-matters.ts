import { dateOnlyOrNull, plain, statusFromMatter } from "../src/ingestion/normalize";
import { governmentSources } from "../src/ingestion/sources";
import { orgNames } from "../src/lib/civic";
import type { Decision, DecisionDeadline, DecisionStatus } from "../src/types";
import { numberOrUndefined, pick, readJson, report, serviceClient, writeJson, type Dict } from "./shared";

/**
 * Matter resolution.
 *
 * Meeting-item records state what appeared on an agenda but usually leave the
 * outcome blank, which is why hundreds of tracked items sat at "Under review"
 * with no way to move. The government's own matter register fills the gap: it
 * carries the published stage, the passed date, the responsible department, the
 * cost when one is stated, and the date of the next scheduled action.
 *
 * Those ids are already in every CivicLens decision id (`charlotte-legistar:29968`
 * is Legistar matter 29968), so this joins directly rather than guessing.
 *
 * Nothing is inferred here. Every value written is a value the government
 * published, and the interface attributes it to that register.
 */

const API = "https://webapi.legistar.com/v1";

/**
 * Legistar's OData endpoint caps a query at 100 nodes, and each `MatterId eq n`
 * clause costs about five. Twenty ids per request is the measured ceiling: 20
 * succeeds, 21 returns "the node count limit of '100' has been exceeded".
 */
const CHUNK_SIZE = 20;

const SELECT = [
  "MatterId",
  "MatterFile",
  "MatterName",
  "MatterTitle",
  "MatterStatusName",
  "MatterAgendaDate",
  "MatterPassedDate",
  "MatterCost",
  "MatterRequester",
  "MatterTypeName",
  "MatterBodyName",
].join(",");

async function fetchMatters(client: string, ids: number[]): Promise<Dict[]> {
  const collected: Dict[] = [];

  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const slice = ids.slice(index, index + CHUNK_SIZE);
    const filter = slice.map((id) => `MatterId eq ${id}`).join(" or ");
    const query = new URLSearchParams({ $filter: filter, $select: SELECT });
    const response = await fetch(`${API}/${client}/matters?${query}`, {
      headers: { "user-agent": "CivicLens/1.0 matter enrichment" },
    });
    if (!response.ok) throw new Error(`${response.status} from ${client}/matters`);
    const rows = (await response.json()) as Dict[] | { message?: string };
    if (!Array.isArray(rows)) throw new Error(`Unexpected matters payload for ${client}`);
    collected.push(...rows);
  }

  return collected;
}

/** Format a YYYY-MM-DD date for prose without shifting the day. */
function proseDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type Applied = {
  statusChanged: boolean;
  outcomeResolved: boolean;
  deadlineSet: boolean;
  requesterSet: boolean;
  costSet: boolean;
};

/**
 * Apply one register row to one decision.
 *
 * Returns the updated decision plus which fields actually moved, so the run can
 * report honestly instead of claiming work it did not do.
 */
function applyMatter(
  decision: Decision,
  matter: Dict,
  sourceUrl: string,
  now: Date,
): { decision: Decision; applied: Applied } {
  const officialStatus = plain(pick(matter, /^MatterStatusName$/i));
  const agendaDate = dateOnlyOrNull(pick(matter, /^MatterAgendaDate$/i));
  const passedDate = dateOnlyOrNull(pick(matter, /^MatterPassedDate$/i));
  const requester = plain(pick(matter, /^MatterRequester$/i));
  const cost = numberOrUndefined(pick(matter, /^MatterCost$/i));

  const applied: Applied = {
    statusChanged: false,
    outcomeResolved: false,
    deadlineSet: false,
    requesterSet: false,
    costSet: false,
  };

  const next: Decision = { ...decision };

  // 1. Stage. The register's own status wins, because it is the published one.
  const resolved: DecisionStatus | null = officialStatus
    ? statusFromMatter(officialStatus, passedDate, agendaDate, now)
    : null;

  if (resolved && resolved !== next.status) {
    applied.statusChanged = true;
    // Only count it as an outcome if it leaves the unresolved pool.
    applied.outcomeResolved = next.status === "Under review";
    next.status = resolved;
  }

  // 2. The date of the next scheduled action — the deadline instrument's fuel.
  const scheduledStatuses: DecisionStatus[] = ["Scheduled for vote", "Public feedback", "Proposed"];
  if (agendaDate && scheduledStatuses.includes(next.status) && new Date(`${agendaDate}T23:59:59Z`) >= now) {
    const deadline: DecisionDeadline = {
      date: agendaDate,
      label: `Scheduled on the ${orgNames[decision.organization]} agenda`,
      sourceUrl,
      officialStatus: officialStatus || undefined,
      origin: "official-tracker",
    };
    if (next.deadline?.date !== deadline.date) applied.deadlineSet = true;
    next.deadline = deadline;

    // Keep the short date list consistent with the confirmed action date.
    const others = next.importantDates.filter((entry) => entry.date !== agendaDate);
    next.importantDates = [{ date: agendaDate, label: "Next scheduled action" }, ...others]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }

  // 3. Who the register names as the requester. Some clients record a department
  //    here and others a staff member's name, so the raw value is kept as-is and
  //    the interface attributes it without relabelling it.
  if (requester && requester.length > 2 && requester !== next.requester) {
    next.requester = requester;
    applied.requesterSet = true;
  }

  // 4. A figure, only when the register states one.
  if (cost !== undefined && cost > 0) {
    const amountUsd = next.money?.amountUsd;
    if (amountUsd !== cost) {
      next.money = { ...next.money, amountUsd: cost };
      applied.costSet = true;
    }
  }

  // 5. Recorded action date, using the register's own wording.
  if (passedDate && (next.status === "Approved" || next.status === "Completed")) {
    next.approvedAt = next.approvedAt ?? `${passedDate}T12:00:00Z`;
  }

  // 6. The update line, quoting the register rather than translating it.
  if (officialStatus) {
    const quoted = `The government's own matter record lists this as “${officialStatus}”`;
    if (passedDate && (next.status === "Approved" || next.status === "Completed")) {
      next.latestUpdate = `Recorded as decided on ${proseDate(passedDate)}. ${quoted}.`;
    } else if (next.deadline?.date) {
      next.latestUpdate = `Scheduled for ${proseDate(next.deadline.date)}. ${quoted}.`;
    } else {
      // No date is attached here on purpose. Stamping the run date would churn the
      // field on every run and imply the register said this today, when all it
      // states is the stage.
      next.latestUpdate = `${quoted}. The register states no date for its next action.`;
    }
  }

  // 7. Fill a placeholder title only. The register's name is not used to rewrite
  //    headlines the record already publishes.
  if (next.title.trim().length < 12) {
    const name = plain(pick(matter, /^MatterName$/i, /^MatterTitle$/i));
    if (name.length > 8) next.title = name;
  }

  return { decision: next, applied };
}

async function main() {
  const decisions = await readJson<Decision[]>("local-decisions.json");
  if (!decisions?.length) {
    report("Matter resolution", [
      "No .civiclens/local-decisions.json found — run `pnpm ingest:local` first.",
    ]);
    return;
  }

  const now = new Date();
  const notes: string[] = [];
  const sources = governmentSources.filter((source) => source.kind === "legistar" && source.client);

  const byId = new Map<string, Decision>();
  for (const decision of decisions) byId.set(decision.id, decision);

  const updated = new Map<string, Decision>(byId);
  /** decision id -> the exact fields this run rewrote. */
  const touched = new Map<string, Set<string>>();
  let matched = 0;
  let unresolvedBefore = 0;
  let unresolvedAfter = 0;
  const counts = { status: 0, outcome: 0, deadline: 0, requester: 0, cost: 0 };

  for (const source of sources) {
    const prefix = `${source.key}:`;
    const candidates = decisions
      .filter((decision) => decision.id.startsWith(prefix))
      .map((decision) => ({ decision, matterId: Number(decision.id.slice(prefix.length)) }))
      .filter((entry) => Number.isInteger(entry.matterId) && entry.matterId > 0);

    if (!candidates.length) {
      notes.push(`${source.name}: no numeric matter ids to resolve.`);
      continue;
    }

    let rows: Dict[] = [];
    try {
      rows = await fetchMatters(source.client!, candidates.map((entry) => entry.matterId));
    } catch (error) {
      notes.push(
        `${source.name}: register unreachable (${error instanceof Error ? error.message : "unknown"}).`,
      );
      continue;
    }

    const matters = new Map<number, Dict>();
    for (const row of rows) {
      const id = numberOrUndefined(pick(row, /^MatterId$/i));
      if (id !== undefined) matters.set(id, row);
    }

    let sourceMatched = 0;
    for (const entry of candidates) {
      if (entry.decision.status === "Under review") unresolvedBefore += 1;

      const matter = matters.get(entry.matterId);
      if (!matter) {
        if (entry.decision.status === "Under review") unresolvedAfter += 1;
        continue;
      }

      sourceMatched += 1;
      matched += 1;

      const result = applyMatter(entry.decision, matter, source.url, now);
      if (result.applied.statusChanged) counts.status += 1;
      if (result.applied.outcomeResolved) counts.outcome += 1;
      if (result.applied.deadlineSet) counts.deadline += 1;
      if (result.applied.requesterSet) counts.requester += 1;
      if (result.applied.costSet) counts.cost += 1;

      // Record which comparable fields moved. Only these are held back from the
      // change feed, so an unrelated genuine movement on the same record — a new
      // timeline event, say — still reports normally.
      const fields = new Set<string>();
      if (result.applied.statusChanged) fields.add("status");
      if (result.applied.deadlineSet) fields.add("deadline");
      if (result.decision.latestUpdate !== entry.decision.latestUpdate) fields.add("latestUpdate");
      if (fields.size) touched.set(entry.decision.id, fields);

      updated.set(entry.decision.id, result.decision);
      if (result.decision.status === "Under review") unresolvedAfter += 1;
    }

    notes.push(`${source.name}: ${sourceMatched}/${candidates.length} matters resolved from the register.`);
  }

  const resolvedDecisions = [...updated.values()];

  // Self-heal caches written before this field was renamed: it held the
  // register's requester, and leaving a stale `department` key would keep the
  // mislabelling this rename exists to remove.
  for (const decision of resolvedDecisions) delete (decision as Dict).department;

  await writeJson("local-decisions.json", resolvedDecisions);

  const withDeadline = resolvedDecisions.filter((decision) => decision.deadline?.date).length;
  const withRequester = resolvedDecisions.filter((decision) => decision.requester).length;
  const resolvedCount = resolvedDecisions.filter((decision) => decision.status !== "Under review").length;

  report("Matter resolution", [
    ...notes,
    "",
    `Matched in register:     ${matched}/${decisions.length}`,
    `Stage changed:           ${counts.status}`,
    `Outcomes resolved:       ${counts.outcome}`,
    `Deadlines set:           ${counts.deadline}`,
    `Requesters resolved:     ${counts.requester}`,
    `Costs resolved:          ${counts.cost}`,
    "",
    `Still "Under review":    ${unresolvedBefore} → ${unresolvedAfter}`,
    `Records with a stage:    ${resolvedCount}/${resolvedDecisions.length}`,
    `Records with a deadline: ${withDeadline}`,
    `Records with a requester:${withRequester}`,
  ]);

  /*
   * Mark what this run rewrote, so change detection can tell a dataset upgrade
   * apart from public movement. Resolving 400 blank outcomes from the register
   * is real work, but it is not the government deciding anything new — reporting
   * it as 400 "changes" would make the movement feed meaningless on day one.
   */
  if (touched.size) {
    await writeJson("resolution.json", {
      producedAt: now.toISOString(),
      reason: "matter-register-resolution",
      entries: [...touched.entries()].map(([decisionId, fields]) => ({
        decisionId,
        fields: [...fields],
      })),
    });
    const fieldCount = [...touched.values()].reduce((total, fields) => total + fields.size, 0);
    console.log(
      `  Marked ${touched.size} records / ${fieldCount} fields as pipeline-resolved (not public movement).`,
    );
  }

  const supabase = serviceClient();
  if (!supabase) {
    console.log("  Supabase credentials absent — cache updated only.");
    return;
  }

  const rows = resolvedDecisions
    .filter((decision) => touched.has(decision.id))
    .map((decision) => ({
      id: decision.id,
      status: decision.status,
      latest_update: decision.latestUpdate,
      next_step: decision.nextStep,
      approved_at: decision.approvedAt ?? null,
      requester: decision.requester ?? null,
      deadline_date: decision.deadline?.date ?? null,
      deadline_label: decision.deadline?.label ?? null,
      amount_usd: decision.money?.amountUsd ?? null,
    }));

  if (!rows.length) {
    console.log("  Nothing changed, so nothing was pushed.");
    return;
  }

  const { error } = await supabase.from("decisions").upsert(rows, { onConflict: "id" });
  console.log(
    error
      ? `  Supabase push failed: ${error.message}`
      : `  Pushed ${rows.length} resolved rows to Supabase.`,
  );
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
