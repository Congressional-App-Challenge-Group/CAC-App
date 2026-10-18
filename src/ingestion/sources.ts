import type { SourceConfig } from "./types";

/**
 * The governments CivicLens ingests.
 *
 * Adding one is a config entry, not new plumbing: `collectLegistar` reads the
 * API client name off the source, and the register join iterates this list. What
 * is *not* interchangeable is each publisher's conventions, and those are the
 * reason a second jurisdiction is worth having at all — a pipeline that only
 * ever met one publisher's field shapes is a pipeline tuned to that publisher.
 *
 * Durham County publishes differently in three ways that matter:
 *   1. its agenda items carry **no action text and no passed flag**, so no stage
 *      can be read from the meeting feed;
 *   2. its matter register uses a *placement* vocabulary for current matters
 *      ("Consent Agenda", "Other Business") rather than an outcome, and has
 *      populated no pass date for any matter since 2025;
 *   3. a large share of its agenda items are ceremonial recognitions.
 *
 * So Durham is listed with `statesOutcomes: false`. Its records are tracked and
 * dated, and the interface says plainly that this publisher's record does not
 * state what happened, instead of leaving a reader to read "under review" as
 * "still pending".
 */
export const governmentSources: SourceConfig[] = [
  {
    key: "charlotte-legistar",
    organization: "charlotte",
    name: "Charlotte City Council",
    kind: "legistar",
    client: "charlottenc",
    url: "https://charlottenc.legistar.com/Calendar.aspx",
    statesOutcomes: true,
  },
  {
    key: "mecklenburg-legistar",
    organization: "mecklenburg-county",
    name: "Mecklenburg Board of County Commissioners",
    kind: "legistar",
    client: "mecklenburg",
    url: "https://mecklenburg.legistar.com/Calendar.aspx",
    statesOutcomes: true,
  },
  {
    key: "durham-legistar",
    organization: "durham-county",
    name: "Durham County Board of Commissioners",
    kind: "legistar",
    client: "durhamcounty",
    url: "https://durhamcounty.legistar.com/Calendar.aspx",
    statesOutcomes: false,
  },
  {
    key: "cms-boarddocs",
    organization: "cms",
    name: "CMS Board of Education",
    kind: "links",
    url: "https://go.boarddocs.com/nc/cmsnc/Board.nsf/Public",
  },
];
