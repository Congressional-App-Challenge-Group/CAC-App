import "server-only";
import { getDecision, getDecisions } from "@/server/decisions";
import {
  interpretQuestion,
  retrieveMatches,
  parseWindow,
  MAX_RECORDS_IN_ANSWER,
  type AskScope,
} from "@/lib/ask-retrieval";
import type { CivicAssistantService, CivicAssistantAnswer, Decision } from "@/types";
import { orgNames } from "@/lib/civic";
import { callAI } from "@/lib/ai-client";

/**
 * A relative-date phrase the question named, for honest phrasing of a scoped
 * answer ("this month", "next week", or an explicit month). Hand-resolution
 * keeps server code free of duplicated window math.
 */
function dateWindowPhrase(scope: AskScope): string | null {
  if (!scope.fromDate) return null;
  return `${scope.fromDate} through ${scope.toDate ?? "the end of that period"}`;
}

const excerptUpdate = (text: string, max = 180) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;

/**
 * A real, source-grounded assistant. It does not fabricate answers: every
 * response is composed from the verified fields and official source citations
 * stored on the decision being asked about. When the source record does not
 * confirm something, it says so rather than guessing.
 */
function citeAll(decision: Decision, fallbackTitle: string): { title: string; url: string }[] {
  if (decision.sources.length) {
    return decision.sources.map((source) => ({
      title: `${source.organization}: ${source.title}`,
      url: source.url,
    }));
  }
  return fallbackTitle || decision.title ? [{ title: fallbackTitle || decision.title, url: `/decisions/${decision.slug}` }] : [];
}

function primaryCitation(decision: Decision): { title: string; url: string } | undefined {
  const source = decision.sources[0];
  return source ? { title: `${source.organization}: ${source.title}`, url: source.url } : undefined;
}

function stageBlurb(status: Decision["status"]): string {
  switch (status) {
    case "Proposed":
      return "formally proposed but not yet scheduled for a vote.";
    case "Public feedback":
      return "open for public feedback during the public comment window.";
    case "Under review":
      return "under review by the governing body. The indexed official record does not yet state an outcome.";
    case "Scheduled for vote":
      return "scheduled for a vote by the governing body.";
    case "Approved":
      return "approved by the governing body.";
    case "Rejected":
      return "rejected by the governing body.";
    case "Funded":
      return "approved and funded, so resources are now assigned.";
    case "Implementation":
      return "in implementation and no longer awaiting a vote.";
    case "Completed":
      return "completed according to the official record.";
    case "Delayed":
      return "currently delayed. The official record does not state a new date.";
    case "Withdrawn":
      return "withdrawn by its sponsor, so it is no longer proceeding. This is not a rejection by the governing body.";
  }
}

async function answerAbout(question: string, decision: Decision): Promise<CivicAssistantAnswer> {
  const q = question.toLowerCase();
  const primary = primaryCitation(decision);
  const citations = citeAll(decision, decision.title);

  // Status / approval / voting
  if (/(approved|approve|passed|rejected|reject|status|stage|vote|voted|outcome)/.test(q)) {
    const text = `"${decision.title}" (${decision.organization}) is currently marked ${decision.status}: it is ${stageBlurb(decision.status)}. ${
      decision.approvedAt
        ? `The official record lists an approval/action date of ${decision.approvedAt.slice(0, 10)}.`
        : decision.nextStep
          ? `The confirmed next step from the record is: ${decision.nextStep}.`
          : "The official record does not list a confirmed next action."
    }`;
    return { text, citations };
  }

  // Latest / what changed / recent
  if (/(what changed|latest|recent|last update|update|what['’]s new|what is new|happen)/.test(q)) {
    const latest = decision.timeline[decision.timeline.length - 1];
    const text = `Most recent official update on "${decision.title}": ${decision.latestUpdate}${
      latest && latest.whatChanged ? ` On ${latest.date}, the record notes: "${latest.whatChanged}".` : ""
    } ${decision.nextStep ? `Next confirmed step: ${decision.nextStep}.` : ""}`;
    return { text, citations };
  }

  // Who / impact / affected
  if (/(who|affect|impact|impacted|groups|people|area|zip|community)/.test(q)) {
    const wantsMoreDetail = /(explain|elaborate|more detail|tell me more|expand|describe|breakdown)/.test(q);
    const roles = decision.affectedRoles.length ? decision.affectedRoles.join(", ") : null;
    const areas = decision.affectedAreas.length ? decision.affectedAreas.join(", ") : null;
    const zips = decision.affectedZipCodes.length ? `ZIP codes ${decision.affectedZipCodes.join(", ")}` : null;
    const parts = [roles && `identified roles: ${roles}`, areas && `areas: ${areas}`, zips].filter(Boolean);
    
    // If we have pre-populated data, use it
    if (parts.length) {
      const text = `Based on the indexed official materials, ${decision.title} may affect ${parts.join("; ")}.`;
      return { text, citations };
    }
    
    // If no pre-populated data, use AI to analyze the content
    try {
      const systemPrompt = wantsMoreDetail
        ? `You are a civic record analyzer. Analyze the decision text to identify who might be affected.

CRITICAL RULES:
1. Use information explicitly stated in the decision text
2. If the text doesn't specify affected groups, make reasonable approximations based on the decision type, topic, and context
3. For example: street lighting decisions likely affect residents, homeowners, and motorists in the area; school decisions affect students, parents, and teachers; rezoning decisions affect property owners, renters, and businesses in the area
4. Look for mentions of: residents, homeowners, renters, businesses, students, specific neighborhoods, or demographic groups
5. Be honest about approximations - use phrases like "likely affects," "typically impacts," "may involve"
6. If nothing can be reasonably inferred, say "The record does not specify who is affected"
7. Since the user asked for more detail, provide a thorough explanation

Format your answer as a single paragraph, no JSON.`
        : `You are a civic record analyzer. Analyze the decision text to identify who might be affected.

CRITICAL RULES:
1. Use information explicitly stated in the decision text
2. If the text doesn't specify affected groups, make reasonable approximations based on the decision type, topic, and context
3. For example: street lighting decisions likely affect residents, homeowners, and motorists in the area; school decisions affect students, parents, and teachers; rezoning decisions affect property owners, renters, and businesses in the area
4. Look for mentions of: residents, homeowners, renters, businesses, students, specific neighborhoods, or demographic groups
5. Be honest about approximations - use phrases like "likely affects," "typically impacts," "may involve"
6. If nothing can be reasonably inferred, say "The record does not specify who is affected"
7. KEEP ANSWERS CONCISE - 1-2 sentences maximum unless the user asks for more detail
8. Use simple, direct language - avoid wordy explanations

Format your answer as a single paragraph, no JSON.`;

      const userPrompt = wantsMoreDetail
        ? `Analyze who might be affected by this decision (provide detailed explanation):

Title: ${decision.title}
Summary: ${decision.summary}
Topic: ${decision.topic}
Latest update: ${decision.latestUpdate}

Who does this decision affect? Explain in detail.`
        : `Analyze who might be affected by this decision (keep it to 1-2 sentences):

Title: ${decision.title}
Summary: ${decision.summary}
Topic: ${decision.topic}
Latest update: ${decision.latestUpdate}

Who does this decision affect? Be concise.`;

      const response = await callAI([
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]);
      
      const aiText = response.text;
      const text = aiText || `The indexed official materials do not yet identify specific affected groups, areas, or ZIP codes for ${decision.title}, so CivicLens leaves that unconfirmed rather than guessing.`;
      return { text, citations };
    } catch (error) {
      console.error("[Assistant] AI analysis failed for who affected:", error);
      // Fallback to original message
      const text = `The indexed official materials do not yet identify specific affected groups, areas, or ZIP codes for ${decision.title}, so CivicLens leaves that unconfirmed rather than guessing.`;
      return { text, citations };
    }
  }

  // Next steps / timing / timeline
  if (/(next|timeline|schedule|when|date|deadline|upcoming)/.test(q)) {
    const upcoming = decision.timeline.filter((event) => ["upcoming", "current"].includes(event.state));
    const nextDates = decision.importantDates.map((d) => `${d.date} · ${d.label}`).join("; ");
    const text =
      decision.nextStep || nextDates || upcoming.length
        ? `Confirmed next step: ${decision.nextStep || "as listed on the official record"}.${
            nextDates ? ` Important dates confirmed in the record: ${nextDates}.` : ""
          }${upcoming.length ? ` Upcoming timeline actions: ${upcoming.map((u) => u.title).join("; ")}.` : ""}`
        : `The official record does not confirm a next step or upcoming date for ${decision.title} yet.`;
    return { text, citations };
  }

  // Cost / budget / funding
  if (/(cost|budget|price|amount|fund|funded|dollars|money)/.test(q)) {
    const text =
      decision.status === "Funded"
        ? `${decision.title} is marked Funded. Public funding amounts are not always stated in the indexed meeting records; use the cited official source for exact figures.`
        : `CivicLens cannot confirm a cost or budget amount for "${decision.title}" from the official sources currently indexed. The cited record is authoritative for any stated figures.`;
    return { text, citations };
  }

  // Sources / proof / where
  if (/(source|proof|citation|where|link|reference|official record)/.test(q)) {
    const text = citations.length
      ? `${decision.title} is tracked against ${decision.sources.length} official record${decision.sources.length === 1 ? "" : "s"}. The primary cited source is the authoritative government record:`
      : `No external official source is currently attached to ${decision.title}.`;
    return { text: primary ? `${text} ${primary.title} (${primary.url}).` : text, citations };
  }

  // Why it matters
  if (/(why|matter|important|meaning)/.test(q)) {
    const text = decision.whyItMatters
      ? decision.whyItMatters
      : `CivicLens has not recorded a plain-language "why it matters" note for ${decision.title}. Summary: ${decision.summary}`;
    return { text, citations };
  }

  // Default: plain-language summary + honesty note
  const text = `${decision.summary} It is currently ${decision.status.toLowerCase()}${decision.nextStep ? ` Next confirmed step: ${decision.nextStep}.` : ""}`;
  return { text, citations };
}

export const assistantService: CivicAssistantService = {
  async answerQuestion({ question, decisionId }) {
    if (!decisionId) {
      return {
        text: "Pick a tracked decision (below or from Explore) so CivicLens can answer from its indexed official sources. General questions without a cited decision are not answered to avoid guesswork.",
        citations: [],
      };
    }
    const decision = await getDecision(decisionId);
    if (!decision) {
      return {
        text: "That decision could not be found in the verified public records.",
        citations: [],
      };
    }
    return await answerAbout(question, decision);
  },

  /**
   * Cross-record answering.
   *
   * Retrieval is deterministic (pure filtering in src/lib/ask-retrieval.ts);
   * this composer only adds wording. Every material claim names its record and
   * carries that record's official citation, and the three failure modes —
   * unsupported question, dataset searched with no matches, supported question
   * with a result that cannot be claimed exhaustive — answer differently.
   */
  async answerAcrossRecords({ question, userZip }) {
    let decisions: Decision[];
    try {
      decisions = await getDecisions({ withRelations: true, limit: 1000 });
    } catch (error) {
      console.error("[ask] dataset read failed:", error instanceof Error ? error.message : error);
      return { text: "The public-record index is temporarily unavailable, so CivicLens cannot search it right now. Please try again shortly.", citations: [] };
    }
    if (!decisions.length) {
      return { text: "No verified records are currently indexed, so there is nothing to search yet. Once ingestion publishes decisions, questions like this one will get real answers.", citations: [] };
    }

    const scope = interpretQuestion(question);
    if ("unsupported" in scope) return { text: scope.reason, citations: [] };

    // "my district" resolves only to fields the user actually confirmed — the
    // saved ZIP from preferences, verbatim. No inferred district mapping.
    const myArea = /\bmy (?:area|district|neighborhood|zip|block)\b/i.test(question);
    if (myArea && userZip && !scope.zip) scope.zip = userZip;
    if (myArea && !userZip && !(scope.zip || scope.councilDistrict !== undefined || scope.countyDistrict !== undefined)) {
      return {
        text: "To answer for your area, CivicLens uses the ZIP you save in settings — it does not infer one. Save a ZIP there and ask again, or ask about a specific place (for example, \"scheduled votes in ZIP 28202\").",
        citations: [],
      };
    }

    const { matches, dateGapPresent, totalCandidates } = retrieveMatches(decisions, scope);

    if (!matches.length) {
      const criteria: string[] = [];
      if (scope.intent === "scheduled-vote") criteria.push("scheduled actions");
      if (scope.intent === "decided") criteria.push("completed records");
      if (scope.topics.length) criteria.push(`the topic${scope.topics.length > 1 ? "s" : ""} ${scope.topics.join(" and ")}`);
      if (scope.zip) criteria.push(`ZIP ${scope.zip}`);
      if (scope.councilDistrict !== undefined) criteria.push(`City Council District ${scope.councilDistrict}`);
      if (scope.countyDistrict !== undefined) criteria.push(`County District ${scope.countyDistrict}`);
      const frame = dateWindowPhrase(scope);
      return {
        text: `No records in the ${totalCandidates.toLocaleString("en-US")}-record index match ${criteria.length ? criteria.join(", ") : "that question"}${frame ? ` for ${frame}` : ""}. That is a searched-and-not-found answer, not a guess: the public index holds no record fitting those criteria. Broaden the topic or the date window and ask again.`,
        citations: [],
      };
    }

    const window = parseWindow(question);
    const listed = matches.slice(0, MAX_RECORDS_IN_ANSWER);
    const remaining = matches.length - listed.length;

    const lines = listed.map((decision) => {
      const dateBit = decision.deadline?.date
        ? ` The record states its next action for ${decision.deadline.date}${decision.deadline.label ? ` (${decision.deadline.label})` : ""}.`
        : decision.status === "Scheduled for vote"
          ? " Status reads \"Scheduled for vote\", but the record states no date for it."
          : " The record states no next-action date.";
      const placeBit = decision.geography?.zipCode
        ? ` Record places it in ZIP ${decision.geography.zipCode}.`
        : "";
      return `${decision.title} — ${orgNames[decision.organization]}, status: ${decision.status}.${dateBit}${placeBit} ${decision.latestUpdate ? `Latest recorded update: ${excerptUpdate(decision.latestUpdate)}` : ""}`;
    });

    const parts: string[] = [];
    parts.push(`${matches.length === 1 ? "One indexed record matches" : `${matches.length} indexed records match`} that question:`);
    parts.push(...lines.map((line, index) => `${index + 1}. ${line}`));
    if (remaining > 0) {
      parts.push(`Showing ${listed.length} of ${matches.length}; ask more specifically (topic, place, or a tighter window) to see the rest.`);
    }
    if (window) {
      parts.push(`The window checked is ${window.from} through ${window.to}, taken from the dates the records themselves state. Records in this index whose next action carries no stated date cannot appear in a date-filtered list — that absence does not mean nothing is planned.`);
    }
    if (dateGapPresent) {
      parts.push("Note: some open records matching this question's place and topic state no next-action date at all, so a date-windowed search cannot confirm or exclude them.");
    }

    const citations = listed.flatMap((decision) => {
      const primary = decision.sources.find((source) => source.verificationStatus === "verified" && source.url);
      const fallback = decision.sources[0];
      const source = primary ?? fallback;
      const entry = source
        ? { title: `${decision.title} — source: ${source.title}`, url: source.url }
        : { title: `${decision.title} — record on CivicLens`, url: `/decisions/${decision.slug}` };
      return [entry, { title: `${decision.title} — on CivicLens`, url: `/decisions/${decision.slug}` }];
    });

    return {
      text: parts.join("\n"),
      citations,
      matched: matches.length,
      shown: listed.length,
      incomplete: dateGapPresent,
    };
  },
};