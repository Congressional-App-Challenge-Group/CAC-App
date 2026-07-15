import type { DecisionStatus, Organization } from "@/types";
export type SourceConfig={key:string;organization:Organization;name:string;kind:"legistar"|"links";url:string;client?:string};
export type NormalizedItem={sourceKey:string;organization:Organization;externalId:string;documentExternalId:string;title:string;body:string;url:string;eventDate:string;status:DecisionStatus;actionText?:string|null;importanceScore:number;confidence:number;topic:string};
