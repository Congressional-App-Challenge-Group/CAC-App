export const roles = [
  "Student",
  "Parent or guardian",
  "Teacher or school employee",
  "Renter",
  "Homeowner",
  "Business owner",
  "Transit rider",
  "Driver",
  "Community organization member",
  "Other resident",
] as const;
export type UserRole = (typeof roles)[number];

export const interests = [
  "Education",
  "School boundaries",
  "School transportation",
  "Student policies",
  "School construction",
  "CMS budget",
  "Housing",
  "Development and rezoning",
  "Roads",
  "Public transit",
  "Public safety",
  "Parks",
  "Taxes",
  "Government budgets",
  "Public health",
  "Libraries",
  "Environment",
] as const;

export const statuses = [
  "Proposed",
  "Public feedback",
  "Under review",
  "Scheduled for vote",
  "Approved",
  "Rejected",
  "Funded",
  "Implementation",
  "Completed",
  "Delayed",
  "Withdrawn",
] as const;
export type DecisionStatus = (typeof statuses)[number];

/**
 * Stage groupings, declared once so the brief, the deadline engine and the
 * filters cannot drift apart on what "still open" means.
 *
 * Delayed is open on purpose: a postponed matter is still live and can still be
 * acted on, which is exactly the case the tracker previously hid.
 */
export const openStatuses = [
  "Proposed",
  "Public feedback",
  "Under review",
  "Scheduled for vote",
  "Delayed",
] as const;

export const decidedStatuses = [
  "Approved",
  "Rejected",
  "Funded",
  "Implementation",
  "Completed",
  "Withdrawn",
] as const;

export const isOpenStatus = (status: DecisionStatus): boolean =>
  (openStatuses as readonly string[]).includes(status);

export const isDecidedStatus = (status: DecisionStatus): boolean =>
  (decidedStatuses as readonly string[]).includes(status);

// Values arrays for server/client validation without leaking tuple-only literals.
export const statusValues: readonly string[] = statuses as readonly string[];
export const organizationValues = [
  "charlotte",
  "mecklenburg-county",
  "durham-county",
  "cms",
] as const;
export type Organization = (typeof organizationValues)[number];

export type VerificationStatus = "verified" | "reviewed" | "unconfirmed";

export type TimelineEvent = {
  id: string;
  decisionId: string;
  date: string;
  stage: DecisionStatus;
  title: string;
  description: string;
  whatChanged?: string;
  state: "completed" | "current" | "upcoming" | "delayed" | "cancelled";
  sourceId?: string;
  verificationStatus: VerificationStatus;
};

export type CivicSource = {
  id: string;
  decisionId: string;
  title: string;
  organization: string;
  url: string;
  publishedAt?: string;
  pageReference?: string;
  lastVerifiedAt: string;
  verificationStatus: VerificationStatus;
};

export type ImportantDate = { date: string; label: string };

/* -------------------------------------------------------------------------- */
/* Geography — where a decision actually lands                                 */
/* -------------------------------------------------------------------------- */

export type GeoConfidence = "exact" | "likely" | "unconfirmed";
export type GeoMethod =
  | "petition-match"
  | "address-match"
  | "record-text"
  | "manual"
  | "none";

export type DecisionGeography = {
  address?: string;
  latitude?: number;
  longitude?: number;
  zipCode?: string;
  neighborhood?: string;
  parcelId?: string;
  sourceUrl?: string;
  /** Petition acreage, when the official dataset states it. */
  acres?: number;
  method: GeoMethod;
  confidence: GeoConfidence;
  verifiedAt?: string;

  /* ---------------------------------------------------------------------- */
  /* Districts — who actually decides, resolved from the county's own        */
  /* boundary layers. A resident's address falls in one of each, which is    */
  /* what lets the product answer "which of my representatives votes on      */
  /* this" without asking anyone to guess.                                   */
  /* ---------------------------------------------------------------------- */

  /** Charlotte City Council district, from the city's own boundary layer. */
  councilDistrict?: number;
  /** District representative, from the same layer. */
  councilDistrictRep?: string;
  councilDistrictRepEmail?: string;

  /** Mecklenburg Board of County Commissioners district. */
  countyDistrict?: number;
  countyDistrictRep?: string;
  countyDistrictRepEmail?: string;

  /** CMS Board of Education district. */
  schoolBoardDistrict?: number;

  /** NC congressional district, as the county publishes it ("12", not "NC-12"). */
  congressionalDistrict?: string;
  /** NC House district. */
  stateHouseDistrict?: string;
  /** NC Senate district. */
  stateSenateDistrict?: string;
};

/* -------------------------------------------------------------------------- */
/* Money — currently 119 budget records store no figure at all                 */
/* -------------------------------------------------------------------------- */

export type DecisionMoney = {
  amountUsd?: number;
  fiscalYear?: string;
  fundingSource?: string;
};

/* -------------------------------------------------------------------------- */
/* Deadlines — the moment a decision stops being changeable                    */
/* -------------------------------------------------------------------------- */

/**
 * Where a deadline came from. The distinction matters: a date taken from the
 * government's own matter register is a stronger claim than one read out of
 * record prose, and the interface says which it is.
 */
export type DeadlineOrigin = "official-tracker" | "record-text";

export type DecisionDeadline = {
  /** ISO date (YYYY-MM-DD) of the next scheduled official action. */
  date?: string;
  /** How the record itself describes that date. */
  label?: string;
  /** Official record the date came from. */
  sourceUrl?: string;
  /** The government's own stage label, quoted verbatim. */
  officialStatus?: string;
  origin: DeadlineOrigin;
};

/* -------------------------------------------------------------------------- */
/* Change detection — what makes "following" mean something                    */
/* -------------------------------------------------------------------------- */

export const changeFields = [
  "status",
  "latestUpdate",
  "nextStep",
  "summary",
  "whyItMatters",
  "timeline",
  "deadline",
] as const;
export type ChangeField = (typeof changeFields)[number];

export type DecisionChange = {
  id: string;
  decisionId: string;
  slug: string;
  title: string;
  organization: Organization;
  field: ChangeField;
  previous: string | null;
  current: string | null;
  changedAt: string;
  sourceUrl?: string;
};

/* -------------------------------------------------------------------------- */
/* Plain-language drafts — AI drafts, editors approve                          */
/* -------------------------------------------------------------------------- */

export const draftFields = ["summary", "whyItMatters", "nextStep", "beforeText", "afterText"] as const;
export type DraftField = (typeof draftFields)[number];

export type DraftStatus = "pending" | "approved" | "rejected";

export type DecisionDraft = {
  id: string;
  decisionId: string;
  field: DraftField;
  draftText: string;
  model: string;
  promptVersion: string;
  sourceExcerpts: string[];
  status: DraftStatus;
  editorId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

/** Fields on a decision that may be replaced by an editor-approved draft. */
export type DraftedFields = Partial<Record<DraftField, string>>;

export type Decision = {
  id: string;
  slug: string;
  title: string;
  organization: Organization;
  topic: string;
  status: DecisionStatus;
  summary: string;
  whyItMatters: string;
  latestUpdate: string;
  nextStep: string | null;
  publishedAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  archivedAt?: string | null;
  lastCheckedAt?: string | null;
  affectedRoles: UserRole[];
  affectedZipCodes: string[];
  affectedAreas: string[];
  importantDates: ImportantDate[];
  beforeText?: string;
  afterText?: string;
  isPublished: boolean;
  timeline: TimelineEvent[];
  sources: CivicSource[];
  /** Populated by the geography spine; absent means "location not confirmed". */
  geography?: DecisionGeography;
  /** Populated when an official record states a figure. */
  money?: DecisionMoney;
  /**
   * The next scheduled official action. Deadlines are only ever read from a
   * date the record already states — CivicLens does not compute comment windows
   * the government has not published.
   */
  deadline?: DecisionDeadline;
  /**
   * Who the government's own register names as the requester. Often a department
   * ("Transportation"), sometimes an individual staff member, so the interface
   * attributes it as "Requested by" rather than labelling both as a department.
   */
  requester?: string;
  /** True when the summary/why-it-matters shown came from an approved draft. */
  plainLanguageApproved?: boolean;

  /* ---------------------------------------------------------------------- */
  /* Matter identity — one thing the government is doing, however many times */
  /* it appeared. These fields exist because the same rezoning is filed as a  */
  /* new Legistar matter at every meeting it touches.                        */
  /* ---------------------------------------------------------------------- */
  /**
   * Stable identity of the underlying matter, independent of appearance count.
   * `petition:<org>:<year>-<seq>`, `matter:<org>:<id>`, or `title:<org>:<title>`.
   */
  matterKey?: string;
  /** Every official record id this matter was assembled from. */
  appearanceIds?: string[];
  /** How many official appearances were merged into this record. */
  appearanceCount?: number;
  /** ISO date of the earliest appearance. */
  firstSeenAt?: string;
  /** ISO date of the most recent official activity. */
  lastActivityAt?: string;
};

export type ObservatoryStory = {
  featured: Pick<Decision, "id" | "slug" | "title" | "organization" | "topic" | "status" | "summary" | "latestUpdate" | "deadline" | "geography"> & {
    source: CivicSource;
    timeline: TimelineEvent[];
    currentStoryDate?: string;
  };
  related: Pick<Decision, "slug" | "title" | "organization" | "status">[];
  deadlines: (Pick<Decision, "slug" | "title" | "organization" | "status"> & {
    date: string;
    label: string;
    sourceUrl?: string;
    sourceTitle?: string;
    scope?: string;
  })[];
  district?: {
    kind: string;
    code: string;
    label: string;
    sourceUrl?: string;
    rings: number[][][];
  };
};

export type UserPreferences = { zipCode: string; roles: UserRole[]; interests: string[] };


export type CivicAssistantAnswer = {
  text: string;
  citations: { title: string; url: string }[];
};

export interface CivicAssistantService {
  answerQuestion(input: {
    question: string;
    decisionId?: string;
    userContext?: UserPreferences;
  }): Promise<CivicAssistantAnswer>;
}
