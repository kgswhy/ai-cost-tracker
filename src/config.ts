import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * The repository root: the first candidate that holds data/projects.csv. The
 * module's own location comes first so `tsx /path/to/src/cli/import.ts` works
 * from any folder (a cron job, another terminal); the current folder is the
 * fallback for bundles that move the module. COST_TRACKER_ROOT overrides both.
 */
export function pickRoot(candidates: (string | undefined)[], exists: (p: string) => boolean = fs.existsSync): string {
  const real = candidates.filter((c): c is string => Boolean(c));
  return real.find((c) => exists(path.join(c, "data", "projects.csv"))) ?? real.at(-1) ?? process.cwd();
}

function moduleRoot(): string | undefined {
  try { return path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); } catch { return undefined; }
}

const rootDir = pickRoot([process.env.COST_TRACKER_ROOT, moduleRoot(), process.cwd()]);
dotenv.config({ path: path.join(rootDir, ".env"), quiet: true });

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

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
