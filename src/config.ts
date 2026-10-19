import "dotenv/config";
import path from "node:path";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

// Every entry point (CLI, Next.js) runs from the repository root.
const rootDir = process.cwd();

export const config = {
  rootDir,
  dataDir: path.join(rootDir, "data"),
  uploadsDir: path.join(rootDir, "data", "uploads"),
  databasePath: path.resolve(rootDir, env("DATABASE_PATH", "./data/cost_tracker.db")),
  vendorC: {
    baseUrl: env("VENDOR_C_BASE_URL", "http://localhost:4010"),
    apiKey: process.env.VENDOR_C_API_KEY ?? "",
  },
  alerts: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
    thresholds: env("ALERT_THRESHOLDS", "80,100")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b),
  },
};
