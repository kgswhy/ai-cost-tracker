import type { ProjectResolver } from "../normalize/project.js";
import type { Rates, UsageRecord } from "../types.js";

export interface ImportContext {
  rates: Rates;
  projects: ProjectResolver;
  /** Human-readable notes about rows the importer dropped or found odd. */
  warn(message: string): void;
}

export interface ImportOutput {
  records: UsageRecord[];
  /** Raw rows seen at the source before dedup/skips. */
  fetched: number;
  /** Rows intentionally not imported (duplicates, totals, overlaps). */
  skipped: number;
}

export interface Importer {
  source: UsageRecord["source"];
  label: string;
  run(ctx: ImportContext): Promise<ImportOutput>;
}
