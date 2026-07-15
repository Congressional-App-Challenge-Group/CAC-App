import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { collectLegistar } from "../src/ingestion/adapters/legistar";
import { governmentSources } from "../src/ingestion/sources";
import { slugify } from "../src/ingestion/normalize";
import { orgNames } from "../src/lib/civic";
import type { Decision, TimelineEvent } from "../src/types";

const lookback=Number(process.env.INGEST_LOOKBACK_DAYS||180);
const since=new Date(Date.now()-lookback*86400000).toISOString().slice(0,10);
const output=resolve(process.cwd(),".civiclens/local-decisions.json");
const sources=governmentSources.filter(source=>source.kind==="legistar");
const decisions:Decision[]=[];

async function main(){
for(const source of sources){
  const result=await collectLegistar(source,since);
  for(const item of result.items){
    const id=`${source.key}-${item.externalId}`;
    const completed=["Approved","Rejected","Completed"].includes(item.status);
    const timeline:TimelineEvent[]=[{id:`${id}-${item.status}`,decisionId:id,date:item.eventDate,stage:item.status,title:item.actionText||item.status,description:item.body||item.title,whatChanged:`The official record currently lists this item as ${item.status}.`,state:completed?"completed":"current",verificationStatus:"verified"}];
    decisions.push({id,slug:`${source.organization}-${item.externalId}-${slugify(item.title)}`,title:item.title,organization:item.organization,topic:item.topic,status:item.status,summary:item.body||item.title,whyItMatters:"This item was identified as a substantive action in an official government meeting record.",latestUpdate:item.actionText||`${item.status} as of ${item.eventDate}.`,nextStep:item.status==="Scheduled for vote"?`Scheduled government action on ${item.eventDate}.`:null,publishedAt:`${item.eventDate}T12:00:00Z`,updatedAt:`${item.eventDate}T12:00:00Z`,approvedAt:completed?`${item.eventDate}T12:00:00Z`:null,archivedAt:null,lastCheckedAt:new Date().toISOString(),affectedRoles:[],affectedZipCodes:[],affectedAreas:[],importantDates:[{date:item.eventDate,label:item.status}],isPublished:true,timeline,sources:[{id:`${id}-source`,decisionId:id,title:`${orgNames[item.organization]} official meeting record`,organization:orgNames[item.organization],url:item.url,publishedAt:item.eventDate,lastVerifiedAt:new Date().toISOString(),verificationStatus:"verified"}]});
  }
}

const active=decisions.filter(decision=>!decision.approvedAt||Date.now()-new Date(decision.approvedAt).getTime()<=60*86400000).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(active,null,2));
console.log(`Local cache: ${active.length} active source-backed decisions from ${sources.length} sources.`);
}

main().catch(error=>{console.error(error);process.exitCode=1});
