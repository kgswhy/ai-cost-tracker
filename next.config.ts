import type { NextConfig } from "next";

const config: NextConfig = {
  // Native and filesystem-bound packages stay outside the bundle.
  serverExternalPackages: ["better-sqlite3", "xlsx"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default config;
