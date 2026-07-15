export const roles = ["Student","Parent or guardian","Teacher or school employee","Renter","Homeowner","Business owner","Transit rider","Driver","Community organization member","Other resident"] as const;
export type UserRole = typeof roles[number];
export const interests = ["Education","School boundaries","School transportation","Student policies","School construction","CMS budget","Housing","Development and rezoning","Roads","Public transit","Public safety","Parks","Taxes","Government budgets","Public health","Libraries","Environment"] as const;
export const statuses = ["Proposed","Public feedback","Under review","Scheduled for vote","Approved","Rejected","Funded","Implementation","Completed","Delayed"] as const;
export type DecisionStatus = typeof statuses[number];
export type Organization = "charlotte" | "mecklenburg-county" | "cms";
export type TimelineEvent = { id:string; decisionId:string; date:string; stage:DecisionStatus; title:string; description:string; whatChanged?:string; state:"completed"|"current"|"upcoming"|"delayed"|"cancelled"; sourceId?:string; verificationStatus:"verified"|"reviewed"|"unconfirmed" };
export type CivicSource = { id:string; decisionId:string; title:string; organization:string; url:string; publishedAt?:string; pageReference?:string; lastVerifiedAt:string; verificationStatus:"verified"|"reviewed"|"unconfirmed" };
export type ImportantDate = { date:string; label:string };
export type Decision = { id:string; slug:string; title:string; organization:Organization; topic:string; status:DecisionStatus; summary:string; whyItMatters:string; latestUpdate:string; nextStep:string|null; publishedAt:string; updatedAt:string; approvedAt?:string|null; archivedAt?:string|null; lastCheckedAt?:string|null; affectedRoles:UserRole[]; affectedZipCodes:string[]; affectedAreas:string[]; importantDates:ImportantDate[]; beforeText?:string; afterText?:string; isPublished:boolean; timeline:TimelineEvent[]; sources:CivicSource[] };
export type UserPreferences = { zipCode:string; roles:UserRole[]; interests:string[] };
export type CivicAssistantAnswer = { text:string; citations:{title:string;url:string}[] };
export interface CivicAssistantService { answerQuestion(input:{question:string;decisionId?:string;userContext?:UserPreferences}):Promise<CivicAssistantAnswer> }
