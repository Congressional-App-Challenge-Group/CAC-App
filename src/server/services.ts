import type{CivicAssistantService}from"@/types";
export interface SourceMonitoringService{checkSources():Promise<{documentsFound:number}>;matchDocuments(decisionId:string):Promise<string[]>}
export interface SummarizationService{summarize(input:{documentId:string}):Promise<{summary:string;citations:string[];confidence:number}>}
export const TODO_INTEGRATIONS="TODO: implement with reviewed official-source ingestion and human approval before publishing.";
export const assistantService:null|CivicAssistantService=null;
