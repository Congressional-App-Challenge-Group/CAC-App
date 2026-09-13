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
    ],
  },
};

export default nextConfig;
