import "server-only";
import { getDecision } from "@/server/decisions";
import type { CivicAssistantService, CivicAssistantAnswer, Decision } from "@/types";

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
      return "under review by the governing body.The indexed official record does not yet state an outcome.";
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
  }
}

function answerAbout(question: string, decision: Decision): CivicAssistantAnswer {
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
    const roles = decision.affectedRoles.length ? decision.affectedRoles.join(", ") : null;
    const areas = decision.affectedAreas.length ? decision.affectedAreas.join(", ") : null;
    const zips = decision.affectedZipCodes.length ? `ZIP codes ${decision.affectedZipCodes.join(", ")}` : null;
    const parts = [roles && `identified roles: ${roles}`, areas && `areas: ${areas}`, zips].filter(Boolean);
    const text = parts.length
      ? `Based on the indexed official materials, ${decision.title} may affect ${parts.join("; ")}.`
      : `The indexed official materials do not yet identify specific affected groups, areas, or ZIP codes for ${decision.title}, so CivicLens leaves that unconfirmed rather than guessing.`;
    return { text, citations };
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
    return answerAbout(question, decision);
  },
};