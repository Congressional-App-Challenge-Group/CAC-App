import type { Organization } from "@/types";

/**
 * Browser-safe description of the official sources CivicLens follows.
 * The ingestion-side configuration lives in `src/ingestion/sources.ts`; this
 * module exists so UI can name the sources without pulling in server code.
 */
export const govSources: Array<{ key: string; name: string; organization: Organization; url: string }> = [
  {
    key: "charlotte-legistar",
    name: "Charlotte City Council",
    organization: "charlotte",
    url: "https://charlottenc.legistar.com/Calendar.aspx",
  },
  {
    key: "mecklenburg-legistar",
    name: "Mecklenburg Board of County Commissioners",
    organization: "mecklenburg-county",
    url: "https://mecklenburg.legistar.com/Calendar.aspx",
  },
  {
    key: "cms-boarddocs",
    name: "CMS Board of Education",
    organization: "cms",
    url: "https://go.boarddocs.com/nc/cmsnc/Board.nsf/Public",
  },
];
