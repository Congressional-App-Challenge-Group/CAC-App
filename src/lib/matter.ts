import type {
  CivicSource,
  Decision,
  DecisionDeadline,
  DecisionGeography,
  DecisionStatus,
  TimelineEvent,
} from "@/types";
import { parsePetitionNumber } from "./geography";

/**
 * The matter spine.
 *
 * Everything else in the product inherits its numbers from here, so this module
 * exists to answer one question honestly: *how many things is the government
 * actually doing?*
 *
 * It previously answered a different question — how many times did something
 * appear on an agenda — and the two are wildly different. Charlotte's Legistar
 * assigns a fresh Matter id to every appearance of the same rezoning petition,
 * so "Rezoning Petition: 2025-036 by Rangeworks" is matter 28286, 28455, 28555,
 * 28694, 28850, 29016, 29300, 29446, 29776 and 29969 — ten records for one
 * rezoning, each of which could only ever sit at "Under review", because an
 * agenda item never states an outcome.
 *
 * It is also why the movement feed looked dead: a matter reappearing on the next
 * agenda is not movement, but the tracker counted it as a new record.
 *
 * Guiding rule, same as the geography spine: identity is only ever asserted from
 * something the record itself carries. A petition number, an official matter id,
 * or the record's own title — never a guess.
 */

/* -------------------------------------------------------------------------- */
/* Stage precedence                                                            */
/* -------------------------------------------------------------------------- */

/**
 * How far along a stage is, for choosing between appearances that disagree.
 *
 * A terminal stage outranks every open one; among the open stages a scheduled
 * vote outranks a deferral, which outranks plain review. Deliberately ordered so
 * the merged record reports the *furthest* thing that has actually happened
 * rather than whichever appearance happened to be read last.
 */
const STAGE_RANK: Record<DecisionStatus, number> = {
  Completed: 100,
  Funded: 96,
  Approved: 95,
  Rejected: 90,
  Withdrawn: 85,
  Implementation: 80,
  "Scheduled for vote": 60,
  Delayed: 50,
  "Public feedback": 40,
  "Under review": 30,
  Proposed: 20,
};

export const stageRank = (status: DecisionStatus): number => STAGE_RANK[status] ?? 0;

/** The stage furthest along among a set of appearances. */
export function furthestStatus(statuses: DecisionStatus[]): DecisionStatus {
  return statuses.reduce(
    (best, status) => (stageRank(status) > stageRank(best) ? status : best),
    statuses[0] ?? "Under review",
  );
}

/* -------------------------------------------------------------------------- */
/* Procedural notices                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Meeting-shaped entities: agenda entries that name a *meeting* rather than a
 * thing anyone decides.
 *
 * These reach the tracker because Legistar publishes them as agenda items and
 * they carry substantive-sounding words, and because the relevance filter scores
 * the title and body together it never sees that the entity itself is a room and
 * a time. Examples in the live data: "Public Hearings - 6:30 PM", "9:00 AM City
 * Council Housing Committee Meeting", "Removed: 6:00 PM Construction Contract".
 *
 * A petition number always wins: a record that identifies a petition is never
 * procedural, whatever else its title says.
 */
const MEETING_TIME = /^\s*\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\b/i;
const BODY_BEFORE_MEETING =
  /\b(committee|commission|council|board|authority)\b[^.]{0,40}\b(meeting|workshop|retreat|session|briefing)\b/i;
const ENDS_WITH_MEETING = /\b(meeting|workshop|retreat)\s*$/i;
/** A title this short that ends in "meeting" is the meeting, not an item on it. */
const STANDALONE_MAX_LENGTH = 60;
const ADMINISTRATIVE =
  /^\s*(removed|invocation|pledge of allegiance|adjournment|roll call|approval of minutes|closed session|upcoming meetings)\b/i;

/**
 * A hearing entry that names nothing to hold a hearing about.
 *
 * This distinction is the whole reason the filter is safe. "Public Hearings -
 * 6:30 PM" and "PUBLIC HEARING" announce a session; "Public Hearing -
 * Uniform Schedules of Values... for the 2027 Reappraisal" is the decision
 * itself, published under a hearing heading.
 */
function isBareHearingEntry(value: string): boolean {
  const remainder = value
    .replace(/^public\s+hearings?\b/i, "")
    .replace(/^[\s:–—-]+/, "")
    .trim();
  if (!remainder) return true;
  if (/^(none|n\/a|tbd|no items?)$/i.test(remainder)) return true;
  // Nothing but a time, optionally followed by a note about the meeting itself.
  return /^\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)\.?(\s*[-–—]\s*.*)?$/i.test(remainder);
}

/**
 * Why a title is not a decision, or null when it might be one.
 *
 * This deliberately errs towards keeping records. A false positive here deletes
 * a real decision from the index, which is the one failure this product cannot
 * afford — an earlier, wider version of this filter treated anything beginning
 * "Public Hearing" as a notice and quietly removed the general obligation bond
 * referendum and the county's recommended budget along with it.
 *
 * So the only entries set aside are ones with no subject at all: a bare hearing
 * entry, a meeting that names a time and a body, or an administrative opener.
 * Everything else stays, and the set-aside rows are written to disk.
 */
export function proceduralReason(title: string): string | null {
  const value = (title || "").trim();
  if (!value) return "Empty record.";

  // A petition number is proof of substance and short-circuits every pattern.
  if (parsePetitionNumber(value)) return null;

  if (/^public\s+hearings?\b/i.test(value)) {
    return isBareHearingEntry(value) ? "Hearing notice with no subject." : null;
  }

  if (ADMINISTRATIVE.test(value)) {
    return /^removed\b/i.test(value)
      ? "Pulled from the agenda before any action was taken."
      : "Administrative opener, not a decision.";
  }

  if (MEETING_TIME.test(value) && BODY_BEFORE_MEETING.test(value)) {
    return "Meeting notice naming a body and a time.";
  }

  if (value.length <= STANDALONE_MAX_LENGTH && ENDS_WITH_MEETING.test(value)) {
    return "Meeting notice rather than an item on the agenda.";
  }

  return null;
}

export const isProceduralEntity = (title: string): boolean => proceduralReason(title) !== null;

/* -------------------------------------------------------------------------- */
/* Canonical identity                                                          */
/* -------------------------------------------------------------------------- */

const LEGISTAR_ID = /^[a-z-]+-legistar:(\d+)$/i;

/** Normalize a title into a comparison key: lowercase, punctuation collapsed. */
export function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The identity of the thing itself, independent of how many times it appeared.
 *
 * Descending order of trust, mirroring the geography matcher:
 *   1. a petition number stated in the title  → `petition:<org>:<year>-<seq>`
 *   2. an official matter id from the record  → `matter:<org>:<id>`
 *   3. the record's own normalized title      → `title:<org>:<title>`
 *
 * Rule 1 exists because rule 2 is exactly what fails on the live data: the same
 * petition carries a different matter id at every meeting.
 */
export function canonicalMatterKey(input: {
  organization: string;
  id: string;
  title: string;
}): string {
  const petition = parsePetitionNumber(input.title);
  if (petition) return `petition:${input.organization}:${petition}`;

  const match = String(input.id).match(LEGISTAR_ID);
  if (match?.[1]) return `matter:${input.organization}:${match[1]}`;

  return `title:${input.organization}:${normalizeTitle(input.title)}`;
}

/* -------------------------------------------------------------------------- */
/* Merging                                                                     */
/* -------------------------------------------------------------------------- */

const geographyScore = (geography?: DecisionGeography): number => {
  if (!geography) return -1;
  const confidence = geography.confidence === "exact" ? 2 : geography.confidence === "likely" ? 1 : 0;
  const fields = [
    geography.address,
    geography.latitude,
    geography.longitude,
    geography.zipCode,
    geography.councilDistrict,
    geography.neighborhood,
    geography.parcelId,
    geography.acres,
  ].filter((value) => value !== undefined && value !== null).length;
  return confidence * 100 + fields;
};

/** The most trustworthy location any appearance established. */
function richestGeography(appearances: Decision[]): DecisionGeography | undefined {
  return appearances
    .map((decision) => decision.geography)
    .filter((geography): geography is DecisionGeography => Boolean(geography))
    .sort((a, b) => geographyScore(b) - geographyScore(a))[0];
}

/**
 * The next date still ahead of us, else the most recent one stated.
 *
 * Appearances each carry their own schedule, so the merged matter takes the
 * soonest *future* date: that is the one a resident can still act on.
 */
function mergeDeadline(appearances: Decision[], now: Date): DecisionDeadline | undefined {
  const dated = appearances
    .map((decision) => decision.deadline)
    .filter((deadline): deadline is DecisionDeadline => Boolean(deadline?.date));
  if (!dated.length) return undefined;

  const today = now.toISOString().slice(0, 10);
  const upcoming = dated
    .filter((deadline) => deadline.date! >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  return upcoming[0] ?? dated.sort((a, b) => b.date!.localeCompare(a.date!))[0];
}

function mergeTimeline(appearances: Decision[], matterId: string): TimelineEvent[] {
  const seen = new Set<string>();
  const events: TimelineEvent[] = [];

  for (const decision of appearances) {
    for (const event of decision.timeline) {
      // One appearance is one date, stage and official action. Anything identical
      // is the same event recorded twice, not two events.
      const key = `${event.date}|${event.stage}|${normalizeTitle(event.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ ...event, decisionId: matterId });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  // Only the final event of the merged matter can be in flight.
  return events.map((event, index) => ({
    ...event,
    state: index === events.length - 1 ? event.state : "completed",
  }));
}

function mergeSources(appearances: Decision[], matterId: string): CivicSource[] {
  const byUrl = new Map<string, CivicSource>();
  for (const decision of appearances) {
    for (const source of decision.sources) {
      if (byUrl.has(source.url)) continue;
      byUrl.set(source.url, source);
    }
  }
  return [...byUrl.values()].map((source, index) => ({
    ...source,
    id: `${matterId}-source-${index}`,
    decisionId: matterId,
  }));
}

function mergeDates(appearances: Decision[]) {
  const byKey = new Map<string, { date: string; label: string }>();
  for (const decision of appearances) {
    for (const date of decision.importantDates ?? []) {
      byKey.set(`${date.date}|${date.label}`, date);
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge every appearance of one matter into a single public record.
 *
 * The "winner" is the appearance furthest along, tie-broken by the most recent
 * activity, and it supplies the record's id and slug. Keeping a real appearance
 * id rather than a synthetic one matters: matter resolution joins the government
 * register on exactly this id, so a synthetic identity would silently break the
 * join that fills in outcomes and deadlines.
 */
export function mergeAppearances(
  appearances: Decision[],
  key: string,
  now = new Date(),
): Decision {
  const ranked = [...appearances].sort((a, b) => {
    const rank = stageRank(b.status) - stageRank(a.status);
    if (rank !== 0) return rank;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const winner = ranked[0];
  const chronological = [...appearances].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const first = chronological[0];
  const last = chronological[chronological.length - 1];

  const timeline = mergeTimeline(appearances, winner.id);
  const status = furthestStatus(appearances.map((decision) => decision.status));
  const requester = appearances.find((decision) => decision.requester)?.requester;
  const money = appearances.find((decision) => decision.money?.amountUsd)?.money ?? winner.money;

  const appearanceIds = [
    ...new Set(
      appearances
        .map((decision) => String(decision.id).match(LEGISTAR_ID)?.[1])
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const decided =
    status === "Approved" ||
    status === "Rejected" ||
    status === "Completed" ||
    status === "Funded" ||
    status === "Withdrawn";

  return {
    ...winner,
    id: winner.id,
    status,
    // The most recent appearance owns the public URL, so a reader landing on the
    // record sees the latest wording rather than a version from eleven months ago.
    slug: last.slug,
    title: last.title || winner.title,
    summary: last.summary || winner.summary,
    latestUpdate: last.latestUpdate || winner.latestUpdate,
    nextStep: last.nextStep ?? winner.nextStep,
    publishedAt: first.publishedAt,
    updatedAt: last.updatedAt,
    approvedAt: decided ? (winner.approvedAt ?? last.approvedAt ?? null) : null,
    lastCheckedAt: last.lastCheckedAt ?? winner.lastCheckedAt,
    affectedRoles: [...new Set(appearances.flatMap((decision) => decision.affectedRoles ?? []))],
    affectedZipCodes: [...new Set(appearances.flatMap((decision) => decision.affectedZipCodes ?? []))],
    affectedAreas: [...new Set(appearances.flatMap((decision) => decision.affectedAreas ?? []))],
    importantDates: mergeDates(appearances),
    timeline,
    sources: mergeSources(appearances, winner.id),
    geography: richestGeography(appearances),
    deadline: mergeDeadline(appearances, now),
    requester,
    money,
    matterKey: key,
    appearanceIds,
    appearanceCount: appearances.length,
    firstSeenAt: first.publishedAt,
    lastActivityAt: last.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Collapse                                                                    */
/* -------------------------------------------------------------------------- */

export type ExcludedEntity = { id: string; title: string; organization: string; reason: string };

export type CollapseResult = {
  matters: Decision[];
  /** Records set aside as meeting notices rather than decisions. Never deleted. */
  excluded: ExcludedEntity[];
  /** Retired slug → surviving slug, so previously shared links keep working. */
  aliases: Record<string, string>;
};

/**
 * Collapse agenda appearances into matters.
 *
 * Two distinct reductions happen here, and they are different in kind:
 *
 *   - **Merging** (many rows → one matter) fixes counting. Nothing is lost; the
 *     appearances become events on the matter's timeline.
 *   - **Exclusion** (a row → no matter) is a judgement, so it is reported rather
 *     than performed silently, and the set-aside rows are written to disk so the
 *     decision stays auditable.
 */
export function collapseToMatters(decisions: Decision[], now = new Date()): CollapseResult {
  const excluded: ExcludedEntity[] = [];
  const groups = new Map<string, Decision[]>();
  const aliases: Record<string, string> = {};

  for (const decision of decisions) {
    const reason = proceduralReason(decision.title);
    if (reason) {
      excluded.push({
        id: decision.id,
        title: decision.title,
        organization: decision.organization,
        reason,
      });
      continue;
    }
    const key = canonicalMatterKey(decision);
    const bucket = groups.get(key);
    if (bucket) bucket.push(decision);
    else groups.set(key, [decision]);
  }

  const matters = [...groups.entries()].map(([key, appearances]) =>
    mergeAppearances(appearances, key, now),
  );

  // A merged-away slug is not dead: point it at the surviving record.
  for (const matter of matters) {
    for (const appearance of groups.get(matter.matterKey!) ?? []) {
      if (appearance.slug !== matter.slug) aliases[appearance.slug] = matter.slug;
    }
  }

  matters.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { matters, excluded, aliases };
}

/* -------------------------------------------------------------------------- */
/* Artifact reconciliation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fold this run's aliases and exclusions into the ones already on disk.
 *
 * Collapse is safe to re-run over its own output — running it on an already
 * collapsed set yields the same matters — but its *side artifacts* were not.
 * Computing them fresh from the input destroyed two things the moment anyone ran
 * `pnpm collapse` twice:
 *
 *   - every slug retired by an earlier run, so links shared before a correction
 *     started 404ing again (the input no longer holds the old slugs to redial);
 *   - the whole exclusion audit trail, since already-set-aside rows are absent
 *     from an already-collapsed input and so were re-reported as "nothing set
 *     aside" — the audit trail silently claiming the exclusions never happened.
 *
 * So both accumulate instead. Two reconciliations keep the accumulation honest:
 * a published id is never also listed as excluded, and an alias chain is always
 * written to its final destination so a redirect never lands on another redirect.
 */
export function reconcileArtifacts(input: {
  previousAliases: Record<string, string>;
  previousExcluded: ExcludedEntity[];
  aliases: Record<string, string>;
  excluded: ExcludedEntity[];
  matters: Array<Pick<Decision, "id" | "slug">>;
}): { aliases: Record<string, string>; excluded: ExcludedEntity[] } {
  const aliases = { ...input.previousAliases, ...input.aliases };
  const live = new Set(input.matters.map((matter) => matter.slug));

  // Follow any chain to its end, so a shared link resolves in one hop.
  for (const [from, to] of Object.entries(aliases)) {
    let target = to;
    const seen = new Set([from]);
    while (aliases[target] && !seen.has(target)) {
      seen.add(target);
      target = aliases[target];
    }
    aliases[from] = target;
  }

  // A slug that is live again is not retired; a self-alias is not an alias.
  for (const [from, to] of Object.entries(aliases)) {
    if (live.has(from) || from === to) delete aliases[from];
  }

  const byId = new Map(input.previousExcluded.map((row) => [row.id, row]));
  for (const row of input.excluded) byId.set(row.id, row);
  // Never contradict the published dataset: a record cannot be both indexed and
  // set aside, so a narrower filter later brought back into the index wins.
  const published = new Set(input.matters.map((matter) => matter.id));
  for (const id of published) byId.delete(id);

  return { aliases, excluded: [...byId.values()] };
}
