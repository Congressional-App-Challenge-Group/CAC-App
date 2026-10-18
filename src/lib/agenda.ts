/**
 * What a published agenda actually schedules, read from the government's own
 * section label.
 *
 * The matter registers publish a section per item — "Consent", "Public Hearing",
 * "Staff Briefings", "Manager's Report". CivicLens previously ignored it, so
 * every item on a future agenda was called "Scheduled for vote", including a
 * staff briefing and a manager's report that schedule no vote at all. That is a
 * false statement about what a government is about to do, on the page whose whole
 * promise is not to make one.
 *
 * The classification only ever reads the government's words. Where the label
 * names nothing recognisable, the item is treated as a decision — the earlier,
 * more cautious behavior — rather than being silently reclassified.
 */

export type AgendaKind = "decision" | "hearing" | "informational" | "unknown";

/**
 * Sections that schedule no vote.
 *
 * Deliberately narrow: a briefing, a report, a presentation or a closed session
 * cannot decide anything. "Appointments" and "Consent" are votes and stay out.
 */
const INFORMATIONAL =
  /briefing|report|presentation|update|proclamation|announcement|moment of silence|invocation|adjournment|closed session|public comment|recognition/i;

const HEARING = /public hearing|hearing/i;

const DECISION =
  /consent|zoning|ordinance|resolution|new business|unfinished business|action item|vote|bid|contract|appointment|budget|agenda ready|on agenda|scheduled|pending|approval/i;

/** Classify one agenda section label. */
export function agendaKind(officialStatus?: string | null): AgendaKind {
  const value = String(officialStatus ?? "").trim();
  if (!value) return "unknown";

  // A labelled hearing is a hearing even though the body may also vote there.
  if (HEARING.test(value)) return "hearing";
  if (INFORMATIONAL.test(value)) return "informational";
  if (DECISION.test(value)) return "decision";
  return "unknown";
}

/** True when the agenda schedules no vote for this item. */
export function schedulesNoVote(officialStatus?: string | null): boolean {
  return agendaKind(officialStatus) === "informational";
}

/** A short, plain description of what the section means for a reader. */
export function agendaKindNote(officialStatus?: string | null): string | null {
  switch (agendaKind(officialStatus)) {
    case "informational":
      return "Informational: the agenda schedules no vote on this item.";
    case "hearing":
      return "Public hearing: the record schedules time for residents to be heard.";
    case "decision":
      return "Scheduled for a decision at this meeting.";
    default:
      return null;
  }
}
