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
  /**
   * True for a gap CivicLens itself closes rather than one it only reports.
   *
   * Reaching into the government's wording is the difference between describing
   * the problem and doing something about it, so the report says which meter it
   * has an answer for. It is the only one where the number is expected to fall.
   */
  ours?: boolean;
  /**
   * True when the meter measures this dataset rather than the government.
   *
   * Affected groups are not published in the source agendas at all, so the
   * record's silence and CivicLens's inability to name the group are the same
   * observation. Such a meter must never be quoted as the headline: it would
   * attribute a limit of the index to the government.
   */
  limit?: boolean;
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
      key: "language",
      missingLabel: "Still in the government's own wording",
      question: "How many records reach a resident in the wording the agency filed?",
      consequence:
        "This one is CivicLens's own gap, and it is the only meter here with a fix. A rewrite is published only after an editor approves it against the source, so a record without an approved rewrite is shown exactly as it was filed — section numbers, recitals and all.",
      missing: decisions.filter((decision) => !decision.plainLanguageApproved).length,
      total,
      share: shareOf(
        decisions.filter((decision) => !decision.plainLanguageApproved).length,
        total,
      ),
      ours: true,
    },
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
      limit: true,
    },
    {
      key: "cost",
      // Phrased so the home page can read "disclose an amount only inside prose".
      missingLabel: "An amount only inside prose",
      question: "Of the records that move public money, how many publish the amount only in the title text?",
      // Verified across all three registers: the cost column came back empty for
      // every indexed matter, while the amounts themselves sit in the title ("…
      // Increasing Both the Expenditures and Revenues … by $365,000"). So the
      // figure is disclosed, and it is not machine-readable.
      consequence:
        "The amount is on the record — “Increasing Both the Expenditures and Revenues … by $365,000” — but the register's own cost field is empty for every matter indexed here. A resident can read it; nothing can total it, compare it across districts, or diff it when it changes. What was omitted is structured data, not disclosure.",
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

/**
 * The strongest omission that is a fact about the government's publishing.
 *
 * Excludes the meter CivicLens answers itself and the one that measures the limit
 * of this index, because quoting either as the headline would overstate what the
 * counting supports. Falls back to the largest share if nothing qualifies.
 */
export function headlineGap(report: DisclosureReport): GapMeter | undefined {
  const publishable = report.gaps.filter((gap) => !gap.ours && !gap.limit);
  const pool = publishable.length ? publishable : report.gaps;
  return [...pool].sort((a, b) => b.share - a.share)[0];
}
