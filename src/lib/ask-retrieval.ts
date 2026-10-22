import type { Decision } from "@/types";
import { isOpenStatus, isDecidedStatus } from "@/types";

/**
 * Cross-record question interpretation and retrieval for the assistant.
 *
 * The single-decision assistant answers from one record's verified fields
 * (src/server/assistant.ts). This module lets a resident ask across all of
 * them — "what is scheduled for a vote next month", "what is happening with
 * rezonings" — without inventing anything. Interpretation is deterministic
 * string/number filtering; nothing here trusts a model, and nothing here
 * fabricates a district, date, or amount that is not on the matched record.
 *
 * Three failure kinds are distinct on purpose:
 *  - "unsupported": the question asks about something the dataset cannot
 *    express (e.g. opinions, future speculation) — explained, not guessed;
 *  - "no-match": the dataset was searched and nothing matched the stated
 *    criteria — a real, checkable result;
 *  - "incomplete": matches exist, but the criteria include dates/statuses that
 *    the dataset only partially records, so the answer must say what it
 *    cannot rule out rather than implying exhaustiveness.
 */

export type AskScope = {
  /** status buckets the question is about; empty = any status */
  statuses: Decision["status"][];
  /** match against topic/summary/title (case-insensitive), empty = any */
  topics: string[];
  /** explicit record geography assets, verbatim-supported only */
  zip?: string;
  councilDistrict?: number;
  countyDistrict?: number;
  /** deadline window. Dates are UTC-day strings YYYY-MM-DD */
  fromDate?: string;
  toDate?: string;
  /** "scheduled-vote" | "open" | "decided" | "recent" | "any" */
  intent: AskIntent;
};

export type AskIntent = "scheduled-vote" | "open" | "decided" | "recent" | "any";

/** Maximum records quoted in one answer. Prevents runaway composition; the
 *  interface states the match count separately from what is shown so a partial
 *  list never reads as exhaustive. */
export const MAX_RECORDS_IN_ANSWER = 5;

const MONTH_WORDS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const TOPIC_WORDS = [
  "rezoning", "zoning", "budget", "housing", "transit", "transportation",
  "school", "safety", "parks", "annexation", "vacation",
  "street", "utility", "environment", "climate",
];

function todayInCharlotte(): string {
  // The deadline engine and observatory treat "today" the same way: the
  // America/New_York civil day, converted to a YYYY-MM-DD string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/**
 * Orchestrate a UTC-day window for a relative phrase.
 * Accepts "this month", "next month", "this week", "next week", "today",
 * "tomorrow", "this year", or an explicit "in 2026"-style year mention.
 * Anything unparseable returns null so the caller may state the limitation
 * rather than invent a window.
 */
export function parseWindow(question: string, today = todayInCharlotte()): { from: string; to: string } | null {
  const q = question.toLowerCase();
  const [yStr, mStr, dStr] = today.split("-");
  const year = Number(yStr), month = Number(mStr), day = Number(dStr);
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  if (/\btoday\b|\bthis evening\b/.test(q)) return { from: today, to: today };
  if (/\btomorrow\b/.test(q)) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const v = iso(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
    return { from: v, to: v };
  }
  if (/\bthis week\b|\bthe next week\b|\bwithin a week\b|\bnext seven days\b/.test(q)) {
    const end = new Date(Date.UTC(year, month - 1, day + 7));
    return { from: today, to: iso(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
  }
  if (/\bnext week\b/.test(q)) {
    const start = new Date(Date.UTC(year, month - 1, day + 7));
    const end = new Date(Date.UTC(year, month - 1, day + 14));
    return { from: iso(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()), to: iso(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
  }
  if (/\bthis month\b|\bthe current month\b/.test(q)) {
    return { from: iso(year, month, 1), to: iso(year, month, lastDay(year, month)) };
  }
  if (/\bnext month\b/.test(q)) {
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    return { from: iso(ny, nm, 1), to: iso(ny, nm, lastDay(ny, nm)) };
  }
  if (/\bthis year\b|\bthe rest of this year\b|\bthis calendar year\b|\bfor the year\b/.test(q)) {
    return { from: today, to: iso(year, 12, 31) };
  }
  // "in October 2026", "next june"
  const monthIndex = MONTH_WORDS.findIndex((name) => new RegExp(`\\b${name}\\b`).test(q));
  if (monthIndex >= 0) {
    const yearInQ = q.match(/\b(20\d{2})\b/);
    const y = yearInQ ? Number(yearInQ[1]) : (monthIndex + 1 < month ? year + 1 : year);
    return { from: iso(y, monthIndex + 1, 1), to: iso(y, monthIndex + 1, lastDay(y, monthIndex + 1)) };
  }
  return null;
}

function normalizeTopic(word: string): string | null {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w === "school") return "school";
  if (w === "utility") return "utility";
  if (w === "transportation") return "transit";
  return TOPIC_WORDS.includes(w) ? w : null;
}

export function findTopics(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[\s,.;:"'()]+/)
    .map(normalizeTopic)
    .filter((topic): topic is string => Boolean(topic))
    .filter((topic, index, all) => all.indexOf(topic) === index);
}

export function findDistrictAssets(question: string): { zip?: string; councilDistrict?: number; countyDistrict?: number } {
  const out: { zip?: string; councilDistrict?: number; countyDistrict?: number } = {};
  const zip = question.match(/\bzip(?:\s*code)?\s*(\d{5})\b/i) ?? question.match(/\b(\d{5})\b(?=.*\bzip\b)/i);
  if (zip) out.zip = zip[1];
  const council = question.match(/\b(?:city\s*)?council\s+district\s+(\d{1,2})\b/i) ?? question.match(/\bdistrict\s+(\d{1,2})\b/i);
  if (council) {
    const n = Number(council[1]);
    if (n >= 1 && n <= 12) out.councilDistrict = n;
  }
  const county = question.match(/\b(?:county\s*commission(?:er)?s?\s*)?county\s+district\s+(\d{1,2})\b/i);
  if (county) {
    const n = Number(county[1]);
    if (n >= 1 && n <= 9) out.countyDistrict = n;
  }
  return out;
}

export function interpretQuestion(question: string, today = todayInCharlotte()): AskScope | { unsupported: true; reason: string } {
  const q = question.toLowerCase();

  // Unsupported categories first — these can never be grounded from indexed
  // records, so naming them is more honest than a weak attempt.
  const unsupported = [
    { test: /\b(opinion|should|think|recommend|my view|argue)\b/, reason: "CivicLens reports what the official record shows; it does not offer opinions or recommendations." },
    { test: /\b(predict|forecast|will the vote go|what will they decide|who will win the vote)\b/, reason: "CivicLens does not predict outcomes. It can show scheduled actions and results that the record already states." },
    { test: /\b(all decisions|every decision|everything) (ever|in history|since the beginning)\b/, reason: "The indexed set covers a defined publication window, so a claim about 'all decisions ever' would be false." },
  ] as const;
  for (const rule of unsupported) {
    if (rule.test.test(q)) return { unsupported: true, reason: rule.reason };
  }

  let intent: AskIntent = "any";
  if (/\b(scheduled|upcoming|will be)\b.{0,20}\b(vote|voting|hearing|decision)\b/.test(q) || /\bscheduled for vote\b/.test(q)) {
    intent = "scheduled-vote";
  } else if (/\b(open|in progress|pending|under review|still)\b/.test(q)) {
    intent = "open";
  } else if (/\b(approved|rejected|funded|completed|withdrawn|decided|passed)\b/.test(q)) {
    intent = "decided";
  } else if (/\b(recent|latest|new|just)\b/.test(q)) {
    intent = "recent";
  }

  const scope: AskScope = { statuses: [], topics: findTopics(question), ...findDistrictAssets(question), intent };

  const window = parseWindow(question, today);
  if (window) {
    scope.fromDate = window.from;
    scope.toDate = window.to;
  }

  // "approved/rejected..." as status words narrow by status bucket even without
  // any deadline window — intent === "decided" does this at filter time.
  return scope;
}

export type MatchResult = {
  matches: Decision[];
  /** true when the question asked for scheduled actions and some matching
   *  records state no date, so absence must be disclosed, not folded away. */
  dateGapPresent: boolean;
  totalCandidates: number;
};

/**
 * Apply the interpreted scope to the dataset. Deterministic: dates compare as
 * UTC-day strings; statuses via the product's own status predicates. Nothing
 * here hits the network and nothing trusts free text for structured fields.
 */
export function retrieveMatches(decisions: Decision[], scope: AskScope, now = todayInCharlotte()): MatchResult {
  const lowerTopics = scope.topics.map((t) => t.toLowerCase());
  const candidates = decisions.filter((decision) => Boolean(decision.isPublished));

  const byTopic = lowerTopics.length
    ? candidates.filter((decision) => {
        const hay = `${decision.title} ${decision.summary} ${decision.topic}`.toLowerCase();
        return lowerTopics.some((topic) => hay.includes(topic));
      })
    : candidates;

  const byGeo = byTopic.filter((decision) => {
    if (!scope.zip && scope.councilDistrict === undefined && scope.countyDistrict === undefined) return true;
    const geo = decision.geography;
    if (scope.zip && geo?.zipCode === scope.zip) return true;
    if (scope.councilDistrict !== undefined && geo?.councilDistrict === scope.councilDistrict) return true;
    if (scope.countyDistrict !== undefined && geo?.countyDistrict === scope.countyDistrict) return true;
    return false;
  });

  const byIntent = byGeo.filter((decision) => {
    switch (scope.intent) {
      case "scheduled-vote": return Boolean(decision.deadline?.date || decision.status === "Scheduled for vote");
      case "open": return isOpenStatus(decision.status);
      case "decided": return isDecidedStatus(decision.status);
      case "recent": return true; // sorted below
      case "any": return true;
    }
  });

  const byDeadline = (scope.fromDate || scope.toDate)
    ? byIntent.filter((decision) => {
        if (!decision.deadline?.date) return false;
        const date = decision.deadline.date;
        if (scope.fromDate && date < scope.fromDate) return false;
        if (scope.toDate && date > scope.toDate) return false;
        return true;
      })
    : byIntent;

  const sorted = [...byDeadline].sort((a, b) => {
    if (scope.intent === "recent") return (b.lastActivityAt || b.updatedAt || "").localeCompare(a.lastActivityAt || a.updatedAt || "");
    if (scope.intent === "scheduled-vote") return (a.deadline?.date ?? "9999").localeCompare(b.deadline?.date ?? "9999");
    return (b.deadline?.date ?? "").localeCompare(a.deadline?.date ?? "");
  });

  const dateGapPresent = scope.intent === "scheduled-vote" &&
    Boolean(scope.fromDate || scope.toDate) &&
    byGeo.some((decision) => isOpenStatus(decision.status) && !decision.deadline?.date);

  return { matches: sorted, dateGapPresent, totalCandidates: candidates.length };
}

export type CrossRecordAnswer = {
  text: string;
  citations: { title: string; url: string }[];
  matched: number;
  shown: number;
  disclosedGap: boolean;
};
