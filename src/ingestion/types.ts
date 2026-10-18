import type { DecisionStatus, Organization } from "@/types";
export type SourceConfig = {
  key: string;
  organization: Organization;
  name: string;
  kind: "legistar" | "links";
  url: string;
  client?: string;
  /**
   * Whether this publisher's own agenda records state what happened to an item.
   *
   * False for a publisher whose agenda items carry no action text and no passed
   * flag, as Durham County's do. It does not change how the feed is read — there
   * is simply nothing to read — but it lets the interface distinguish "no outcome
   * was published" from "the outcome is still pending", which are opposite
   * claims and only one of which is true.
   */
  statesOutcomes?: boolean;
};
export type NormalizedItem={sourceKey:string;organization:Organization;externalId:string;entityId:string;documentExternalId:string;title:string;body:string;url:string;eventDate:string;status:DecisionStatus;actionText?:string|null;importanceScore:number;confidence:number;topic:string};
