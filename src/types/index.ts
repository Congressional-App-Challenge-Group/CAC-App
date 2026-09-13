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
] as const;
export type DecisionStatus = (typeof statuses)[number];

// Values arrays for server/client validation without leaking tuple-only literals.
export const statusValues: readonly string[] = statuses as readonly string[];
export const organizationValues = ["charlotte", "mecklenburg-county", "cms"] as const;
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
  councilDistrict?: number;
  neighborhood?: string;
  parcelId?: string;
  sourceUrl?: string;
  /** District representative, from the city's official council-district layer. */
  councilDistrictRep?: string;
  councilDistrictRepEmail?: string;
  /** Petition acreage, when the official dataset states it. */
  acres?: number;
  method: GeoMethod;
  confidence: GeoConfidence;
  verifiedAt?: string;
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
/* Change detection — what makes "following" mean something                    */
/* -------------------------------------------------------------------------- */

export const changeFields = [
  "status",
  "latestUpdate",
  "nextStep",
  "summary",
  "whyItMatters",
  "timeline",
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
  /** True when the summary/why-it-matters shown came from an approved draft. */
  plainLanguageApproved?: boolean;
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
