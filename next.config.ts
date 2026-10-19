import type { NextConfig } from "next";

const config: NextConfig = {
  // Native and filesystem-bound packages stay outside the bundle.
  serverExternalPackages: ["better-sqlite3", "xlsx"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  // Keep `next dev` from writing an AGENTS.md into the working tree.
  agentRules: false,
};

export default config;
