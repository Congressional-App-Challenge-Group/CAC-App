import type { Decision, Organization } from "@/types";
import { isDecidedStatus, isOpenStatus } from "@/types";
import { orgNames } from "@/lib/civic";
import { nextDeadline } from "@/lib/deadlines";

/**
 * Disclosure gap.
 *
 * Every other civic product answers "what did the government publish". This
 * measures the opposite: what the government did *not* publish. It exists
 * because the honest reading of the record set is itself the story — hundreds of
 * agenda items that state an outcome and nothing about who it affects.
 *
 * The rule that keeps this credible: never state a gap more broadly than the
 * data supports. Every meter carries its own denominator, and the report
 * declares its exact scope in words.
 */

export type GapMeter = {
  key: string;
  /** What the government omitted. */
  missingLabel: string;
  /** The plain question the meter answers. */
  question: string;
  /** Why this omission matters to a resident. */
  consequence: string;
  missing: number;
  total: number;
  /** Missing / total, 0–1. Zero when the denominator is empty. */
  share: number;
};

export type DisclosureReport = {
  generatedAt: string;
  total: number;
  open: number;
  decided: number;
  /** Records with a confirmed location. */
  located: number;
  /** Records carrying a stated upcoming action date. */
  scheduled: number;
  /** Records the register resolved to a real outcome. */
  resolved: number;
  organizations: Array<{ key: Organization; name: string; total: number }>;
  /** First and last record dates actually present, not an assumed window. */
  firstRecordDate?: string;
  lastRecordDate?: string;
  gaps: GapMeter[];
  /** Open items with no outcome recorded, older than the staleness horizon. */
  stuck: { count: number; shareOfOpen: number; olderThanDays: number };
  /** Items that never produced a second timeline event. */
  singleEvent: { count: number; share: number };
  /** A sentence stating exactly what was counted. */
  scopeStatement: string;
};

export const MONEY_TOPICS = ["Government budgets", "Taxes"];

const round = (value: number, places = 3) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const shareOf = (missing: number, total: number) => (total > 0 ? round(missing / total) : 0);

const dateOnly = (value?: string | null): string | undefined => {
  const match = value ? String(value).match(/^(\d{4}-\d{2}-\d{2})/) : null;
  return match ? match[1] : undefined;
};

export type DisclosureOptions = {
  now?: Date;
  /** How long an open item may sit without an outcome before it counts as stuck. */
  staleDays?: number;
};

export function buildDisclosureReport(
  decisions: Decision[],
  options: DisclosureOptions = {},
): DisclosureReport {
  const now = options.now ?? new Date();
  const staleDays = options.staleDays ?? 120;

  const total = decisions.length;
  const open = decisions.filter((decision) => isOpenStatus(decision.status)).length;
  const decided = decisions.filter((decision) => isDecidedStatus(decision.status)).length;

  const located = decisions.filter((decision) => isLocated(decision)).length;
  const scheduled = decisions.filter((decision) => nextDeadline(decision, now) !== null).length;
  const resolved = decided;

  const moneyRecords = decisions.filter((decision) => MONEY_TOPICS.includes(decision.topic));
  const openRecords = decisions.filter((decision) => isOpenStatus(decision.status));

  const gaps: GapMeter[] = [
    {
      key: "location",
      missingLabel: "No location disclosed",
      question: "Which records never say where they land?",
      consequence:
        "Without an address, parcel or ZIP on the record, a resident cannot tell whether it is their street.",
      missing: total - located,
      total,
      share: shareOf(total - located, total),
    },
    {
      key: "affected",
      missingLabel: "No affected group recorded",
      question: "Which records state no affected group?",
      // Deliberately framed as a limit of the data held here. The source agendas
      // do not name affected groups, and CivicLens does not infer them, so this
      // figure cannot be attributed to the government alone.
      consequence:
        "Neither the published agenda nor CivicLens's indexing names who this affects, and CivicLens does not infer affected groups. Read this one as a limit of the dataset held here rather than of disclosure alone.",
      missing: decisions.filter((decision) => decision.affectedRoles.length === 0).length,
      total,
      share: shareOf(
        decisions.filter((decision) => decision.affectedRoles.length === 0).length,
        total,
      ),
    },
    {
      key: "cost",
      missingLabel: "No figure stated",
      question: "Of the records that move public money, how many state an amount?",
      // Verified against the governments' own registers: Charlotte's cost field
      // is empty across every matter, so this gap is the publisher's, not ours.
      consequence:
        "A budget or contract item with no figure cannot be checked from outside. This one is the government's own omission: the register's cost field came back empty for every indexed matter from Charlotte.",
      missing: moneyRecords.filter((decision) => !decision.money?.amountUsd).length,
      total: moneyRecords.length,
      share: shareOf(
        moneyRecords.filter((decision) => !decision.money?.amountUsd).length,
        moneyRecords.length,
      ),
    },
    {
      key: "schedule",
      missingLabel: "No action date stated",
      question: "Of the items still open, how many state no date for the next action?",
      consequence:
        "An open item with no date cannot be acted on in time. This is the gap that turns a decision into a fait accompli.",
      missing: openRecords.filter((decision) => nextDeadline(decision, now) === null).length,
      total: openRecords.length,
      share: shareOf(
        openRecords.filter((decision) => nextDeadline(decision, now) === null).length,
        openRecords.length,
      ),
    },
    {
      key: "source",
      missingLabel: "No official link",
      question: "Which records cite no official document at all?",
      consequence:
        "Every record on CivicLens should be traceable to the government's own publication. A record without one is a claim without a source.",
      missing: decisions.filter(
        (decision) => !decision.sources.some((source) => /^https?:/i.test(source.url)),
      ).length,
      total,
      share: shareOf(
        decisions.filter((decision) => !decision.sources.some((source) => /^https?:/i.test(source.url)))
          .length,
        total,
      ),
    },
  ];

  const stuckRecords = openRecords.filter((decision) => {
    if (decision.status !== "Under review") return false;
    const seen = new Date(decision.updatedAt || decision.publishedAt).getTime();
    if (Number.isNaN(seen)) return false;
    return (now.getTime() - seen) / 86_400_000 > staleDays;
  });

  const singleEvent = decisions.filter((decision) => decision.timeline.length <= 1).length;

  const organizationCounts = new Map<Organization, number>();
  for (const decision of decisions) {
    organizationCounts.set(decision.organization, (organizationCounts.get(decision.organization) || 0) + 1);
  }

  const dates = decisions
    .map((decision) => dateOnly(decision.updatedAt) ?? dateOnly(decision.publishedAt))
    .filter((value): value is string => Boolean(value))
    .sort();

  return {
    generatedAt: now.toISOString(),
    total,
    open,
    decided,
    located,
    scheduled,
    resolved,
    organizations: [...organizationCounts.entries()]
      .map(([key, count]) => ({ key, name: orgNames[key] ?? key, total: count }))
      .sort((a, b) => b.total - a.total),
    firstRecordDate: dates[0],
    lastRecordDate: dates[dates.length - 1],
    gaps,
    stuck: {
      count: stuckRecords.length,
      shareOfOpen: shareOf(stuckRecords.length, open),
      olderThanDays: staleDays,
    },
    singleEvent: { count: singleEvent, share: shareOf(singleEvent, total) },
    scopeStatement: buildScopeStatement(decisions.length, organizationCounts, dates[0], dates[dates.length - 1]),
  };
}

function isLocated(decision: Decision): boolean {
  const geography = decision.geography;
  if (geography && geography.method !== "none") {
    return Boolean(geography.address || geography.zipCode || geography.latitude !== undefined);
  }
  return decision.affectedZipCodes.length > 0;
}

/**
 * The scope sentence. Deliberately narrow: it names the record counts and the
 * sources and never generalises to "local government" as a whole.
 */
function buildScopeStatement(
  total: number,
  organizations: Map<Organization, number>,
  first?: string,
  last?: string,
): string {
  const parts = [...organizations.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${count} from ${orgNames[key] ?? key}`);

  const window = first && last ? ` published between ${first} and ${last}` : "";
  return `Measured across the ${total} local government records CivicLens indexed (${parts.join(
    ", ",
  )})${window}. These figures describe this indexed set, not local government in general.`;
}

/** Percentage, for display. Kept here so no surface rounds differently. */
export function gapPercent(meter: GapMeter): number {
  return Math.round(meter.share * 100);
}
