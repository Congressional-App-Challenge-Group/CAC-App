import type { ChangeField, Decision, DecisionChange } from "@/types";

/**
 * Change detection.
 *
 * The product promises that following something means you'll hear when it
 * moves. Today 540 of 561 records have a single timeline event, so nothing ever
 * "moves". This module diffs successive snapshots of the record set and emits
 * explicit change records, which is what every notification and "what changed"
 * surface reads from.
 */

/** The comparable state of one decision at a point in time. */
export type SnapshotEntry = {
  id: string;
  slug: string;
  title: string;
  organization: Decision["organization"];
  status: string;
  summary: string;
  whyItMatters: string;
  latestUpdate: string;
  nextStep: string | null;
  updatedAt: string;
  timelineCount: number;
  sourceUrl?: string;
};

export type Snapshot = {
  capturedAt: string;
  entries: SnapshotEntry[];
};

const COMPARABLE_FIELDS: ChangeField[] = [
  "status",
  "latestUpdate",
  "nextStep",
  "summary",
  "whyItMatters",
  "timeline",
];

function fieldValue(entry: SnapshotEntry, field: ChangeField): string | null {
  switch (field) {
    case "timeline":
      return String(entry.timelineCount);
    case "nextStep":
      return entry.nextStep ?? null;
    default:
      return entry[field] ?? null;
  }
}

/** A stable, repeatable identifier so the same change never double-counts. */
export function changeId(decisionId: string, field: ChangeField, changedAt: string): string {
  return `${decisionId}:${field}:${changedAt}`;
}

export function toSnapshotEntry(decision: Decision): SnapshotEntry {
  return {
    id: decision.id,
    slug: decision.slug,
    title: decision.title,
    organization: decision.organization,
    status: decision.status,
    summary: decision.summary,
    whyItMatters: decision.whyItMatters,
    latestUpdate: decision.latestUpdate,
    nextStep: decision.nextStep,
    updatedAt: decision.updatedAt,
    timelineCount: decision.timeline.length,
    sourceUrl: decision.sources[0]?.url,
  };
}

export function toSnapshot(decisions: Decision[], capturedAt = new Date().toISOString()): Snapshot {
  return { capturedAt, entries: decisions.map(toSnapshotEntry) };
}

export type DiffOptions = {
  /** Ignore changes older than this many days. */
  maxAgeDays?: number;
  /** Restrict the diff to these decision ids. */
  decisionIds?: string[];
};

/**
 * Diff a previous snapshot against the current record set.
 *
 * New records are intentionally not reported as changes — a first appearance is
 * a publication, not a movement, and blending the two would make the "what
 * changed" feed useless on a first run.
 */
export function diffSnapshots(
  previous: Snapshot,
  current: Decision[],
  options: DiffOptions = {},
): DecisionChange[] {
  const previousById = new Map(previous.entries.map((entry) => [entry.id, entry]));
  const allowed = options.decisionIds ? new Set(options.decisionIds) : null;
  const cutoff =
    options.maxAgeDays && options.maxAgeDays > 0
      ? Date.now() - options.maxAgeDays * 86_400_000
      : null;

  const changes: DecisionChange[] = [];

  for (const decision of current) {
    if (allowed && !allowed.has(decision.id)) continue;

    const before = previousById.get(decision.id);
    if (!before) continue;

    const after = toSnapshotEntry(decision);
    for (const field of COMPARABLE_FIELDS) {
      const previousValue = fieldValue(before, field);
      const currentValue = fieldValue(after, field);
      if (previousValue === currentValue) continue;
      // Ignore a timeline that only lost events, which usually means a re-parse.
      if (field === "timeline" && Number(currentValue ?? 0) <= Number(previousValue ?? 0)) {
        continue;
      }

      const changedAt = decision.updatedAt || previous.capturedAt;
      if (cutoff && new Date(changedAt).getTime() < cutoff) continue;

      changes.push({
        id: changeId(decision.id, field, changedAt),
        decisionId: decision.id,
        slug: decision.slug,
        title: decision.title,
        organization: decision.organization,
        field,
        previous: field === "timeline" ? null : previousValue,
        current: field === "timeline" ? null : currentValue,
        changedAt,
        sourceUrl: decision.sources[0]?.url,
      });
    }
  }

  return changes.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export function changesSince(changes: DecisionChange[], days: number): DecisionChange[] {
  const cutoff = Date.now() - days * 86_400_000;
  return changes.filter((change) => new Date(change.changedAt).getTime() >= cutoff);
}

/** Group changes by decision so a feed can show "3 fields moved on this item". */
export function groupChangesByDecision(
  changes: DecisionChange[],
): Array<{ decisionId: string; slug: string; title: string; organization: Decision["organization"]; changes: DecisionChange[] }> {
  const groups = new Map<string, DecisionChange[]>();
  for (const change of changes) {
    const bucket = groups.get(change.decisionId);
    if (bucket) bucket.push(change);
    else groups.set(change.decisionId, [change]);
  }

  return [...groups.entries()]
    .map(([decisionId, group]) => ({
      decisionId,
      slug: group[0].slug,
      title: group[0].title,
      organization: group[0].organization,
      changes: group,
    }))
    .sort((a, b) => b.changes[0].changedAt.localeCompare(a.changes[0].changedAt));
}

export function changeFieldLabel(field: ChangeField): string {
  switch (field) {
    case "status":
      return "Stage changed";
    case "latestUpdate":
      return "New official update";
    case "nextStep":
      return "Next step changed";
    case "summary":
      return "Summary revised";
    case "whyItMatters":
      return "Impact note revised";
    case "timeline":
      return "New action recorded";
    default:
      return "Updated";
  }
}
