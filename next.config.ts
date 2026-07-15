import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./.civiclens/local-decisions.json"],
  },
};
export default nextConfig;
