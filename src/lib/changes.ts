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
  /** Date of the next scheduled action, so a vote date being set reads as movement. */
  deadlineDate: string | null;
  sourceUrl?: string;
};

export type Snapshot = {
  capturedAt: string;
  /**
   * Which record model produced this snapshot.
   *
   * A snapshot taken before the matter collapse holds one entry per agenda
   * appearance; the same government activity afterwards holds one entry per
   * matter. Diffing across that boundary reports the restructuring itself as
   * dozens of timeline changes, which is not movement — so a snapshot from a
   * different model is treated as a new baseline instead.
   */
  model?: string;
  entries: SnapshotEntry[];
};

/** Bump this whenever the shape or identity of a tracked record changes. */
export const SNAPSHOT_MODEL = "matters-v1";

const COMPARABLE_FIELDS: ChangeField[] = [
  "status",
  "latestUpdate",
  "nextStep",
  "summary",
  "whyItMatters",
  "timeline",
  "deadline",
];

function fieldValue(entry: SnapshotEntry, field: ChangeField): string | null {
  switch (field) {
    case "timeline":
      return String(entry.timelineCount);
    case "deadline":
      return entry.deadlineDate;
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
    deadlineDate: decision.deadline?.date ?? null,
    sourceUrl: decision.sources[0]?.url,
  };
}

export function toSnapshot(decisions: Decision[], capturedAt = new Date().toISOString()): Snapshot {
  return { capturedAt, model: SNAPSHOT_MODEL, entries: decisions.map(toSnapshotEntry) };
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
      // A cleared deadline is bookkeeping (the date passed, or a re-parse), not
      // news. Only a newly stated action date is reported.
      if (field === "deadline" && !currentValue) continue;

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

  return (changes || []).sort((a, b) => (b.changedAt || "").localeCompare(a.changedAt || ""));
}

/** What a pipeline job reports it rewrote, so its own edits are not misread as movement. */
export type PipelineResolution = {
  producedAt: string;
  reason: string;
  entries: Array<{ decisionId: string; fields: string[] }>;
};

/**
 * Split pipeline-caused edits out of a change set.
 *
 * A dataset upgrade is not public movement. When an enrichment job fills in
 * hundreds of previously blank outcomes, every one of those records genuinely
 * differs from the last snapshot — but no government decided anything new.
 * Reporting that as hundreds of "changes" would make the movement feed
 * meaningless on the run it matters most, so the job names exactly which records
 * and fields it rewrote and those are held back.
 *
 * The match is per record *and* field, so an unrelated genuine movement on the
 * same record — a new timeline event, say — still reports normally.
 */
export function holdBackPipelineResolutions(
  changes: DecisionChange[],
  resolution: PipelineResolution | null,
): { changes: DecisionChange[]; heldBack: DecisionChange[] } {
  if (!resolution) return { changes, heldBack: [] };

  const rewritten = new Set(
    resolution.entries.flatMap((entry) =>
      entry.fields.map((field) => `${entry.decisionId}:${field}`),
    ),
  );

  const kept: DecisionChange[] = [];
  const heldBack: DecisionChange[] = [];
  for (const change of changes) {
    if (rewritten.has(`${change.decisionId}:${change.field}`)) heldBack.push(change);
    else kept.push(change);
  }

  return { changes: kept, heldBack };
}

export function changesSince(changes: DecisionChange[], days: number): DecisionChange[] {
  const cutoff = Date.now() - days * 86_400_000;
  return changes.filter((change) => new Date(change.changedAt).getTime() >= cutoff);
}

/** Group changes by decision so a feed can show "3 fields moved on this item". */
export function groupChangesByDecision(
  changes: DecisionChange[],
): Array<{ decisionId: string; slug: string; title: string; organization: Decision["organization"]; changes: DecisionChange[] }> {
  if (!changes || changes.length === 0) return [];
  
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
    .sort((a, b) => (b.changes[0].changedAt || "").localeCompare(a.changes[0].changedAt || ""));
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
    case "deadline":
      return "Scheduled action date set";
    default:
      return "Updated";
  }
}
