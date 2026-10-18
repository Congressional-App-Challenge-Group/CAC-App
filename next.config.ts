import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Static deployment mode reads these files at runtime when Supabase is not
   * configured. They are gitignored, so they must both be generated at build
   * time (see scripts/prepare-data.ts) and traced into the output — otherwise a
   * deployed build renders with no records and no change history.
   */
  outputFileTracingIncludes: {
    "/*": [
      "./.civiclens/local-decisions.json",
      "./.civiclens/drafts.json",
      "./.civiclens/changes.json",
      // Slugs retired by the matter collapse resolve to their surviving record,
      // so a link shared before CivicLens corrected its own counting still works.
      "./.civiclens/slug-aliases.json",
      // Generalised district boundaries, used only to place a reader's own
      // address. Record-level district matching reads the codes already stored
      // on each record, so this artifact being absent degrades the address
      // lookup alone rather than emptying the district surfaces.
      "./.civiclens/place-boundaries.json",
    ],
  },
};

export default nextConfig;
