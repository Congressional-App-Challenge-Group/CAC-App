import type { Organization } from "@/types";

/**
 * Browser-safe description of the official sources CivicLens follows.
 * The ingestion-side configuration lives in `src/ingestion/sources.ts`; this
 * module exists so UI can name the sources without pulling in server code.
 */
export const govSources: Array<{
  key: string;
  name: string;
  organization: Organization;
  url: string;
  /** Mirrors `SourceConfig.statesOutcomes` on the ingestion side. */
  statesOutcomes: boolean;
}> = [
  {
    key: "charlotte-legistar",
    name: "Charlotte City Council",
    organization: "charlotte",
    url: "https://charlottenc.legistar.com/Calendar.aspx",
    statesOutcomes: true,
  },
  {
    key: "mecklenburg-legistar",
    name: "Mecklenburg Board of County Commissioners",
    organization: "mecklenburg-county",
    url: "https://mecklenburg.legistar.com/Calendar.aspx",
    statesOutcomes: true,
  },
  {
    key: "durham-legistar",
    name: "Durham County Board of Commissioners",
    organization: "durham-county",
    url: "https://durhamcounty.legistar.com/Calendar.aspx",
    statesOutcomes: false,
  },
  {
    key: "cms-boarddocs",
    name: "CMS Board of Education",
    organization: "cms",
    url: "https://go.boarddocs.com/nc/cmsnc/Board.nsf/Public",
    statesOutcomes: true,
  },
];

/**
 * Whether a publisher's own record states what happened to an item.
 *
 * This exists because "under review" is doing two different jobs. For Charlotte
 * it means the register has not closed the matter yet. For Durham it can only
 * ever mean that the publisher does not state outcomes at all — no pass date has
 * been populated for any Durham matter since 2025, and its agenda items carry no
 * action text. Those are opposite claims, and only one of them is true for a
 * given record, so the interface must not print the same sentence for both.
 */
export function publisherStatesOutcomes(organization: Organization): boolean {
  return govSources.find((source) => source.organization === organization)?.statesOutcomes ?? true;
}

/** The sentence to print when a publisher's record states no outcome. */
export const NO_OUTCOME_STATED =
  "This publisher's record does not state what happened to this item, so its outcome is unknown rather than pending.";

/**
 * The update line for a matter whose outcome the record does not state.
 *
 * Pure, and recomputed from the register on every run rather than appended to,
 * so a second pipeline run produces the identical sentence instead of stacking
 * another one onto it.
 *
 * `quoted` is the register's own wording, already framed by the caller.
 */
export function unstatedOutcomeNote(organization: Organization, quoted: string): string {
  return publisherStatesOutcomes(organization)
    ? `${quoted}. The register states no date for its next action.`
    : `${quoted}. ${NO_OUTCOME_STATED}`;
}
