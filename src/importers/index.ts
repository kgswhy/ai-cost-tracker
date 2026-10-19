import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { finishImportRun, failImportRun, openDatabase, removeStaleRecords, startImportRun, upsertProjects, upsertUsageRecords, type Db } from "../db/index.js";
import { createProjectResolver, loadAliases, loadProjectsCsv } from "../normalize/project.js";
import type { Rates } from "../types.js";
import { manualOpsImporter } from "./manualOps.js";
import type { ImportContext, Importer } from "./types.js";
import { vendorAImporter } from "./vendorA.js";
import { vendorBImporter } from "./vendorB.js";
import { vendorCImporter } from "./vendorC.js";

export interface SourceSummary {
  source: string;
  label: string;
  status: "ok" | "failed";
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  removed: number;
  unassigned: number;
  warnings: string[];
  error?: string;
}

export function defaultImporters(): Importer[] {
  const data = path.join(config.rootDir, "data");
  return [
    vendorAImporter(path.join(data, "vendor_a.csv")),
    vendorBImporter(path.join(data, "vendor_b.csv")),
    vendorCImporter({ baseUrl: config.vendorC.baseUrl, apiKey: config.vendorC.apiKey }),
    manualOpsImporter(path.join(data, "manual_ops.xlsx")),
  ];
}

export function loadReferenceData() {
  const data = path.join(config.rootDir, "data");
  const rates = JSON.parse(fs.readFileSync(path.join(data, "rates.json"), "utf8")) as Rates;
  const projects = loadProjectsCsv(path.join(data, "projects.csv"));
  const aliases = loadAliases(path.join(config.rootDir, "config", "project_aliases.json"));
  return { rates, projects, resolver: createProjectResolver(projects, aliases) };
}

/**
 * Runs every importer against the database. Each source is its own
 * transaction and its own import_runs row, so one vendor being down does not
 * block the others. Returns a per-source summary for the CLI and dashboard.
 */
export async function runImport(opts: { db?: Db; importers?: Importer[]; only?: string[] } = {}): Promise<SourceSummary[]> {
  const db = opts.db ?? openDatabase(config.databasePath);
  const { rates, projects, resolver } = loadReferenceData();
  upsertProjects(db, projects);

  const importers = (opts.importers ?? defaultImporters()).filter((i) => !opts.only || opts.only.includes(i.source));
  const summaries: SourceSummary[] = [];

  for (const importer of importers) {
    const warnings: string[] = [];
    const ctx: ImportContext = { rates, projects: resolver, warn: (m) => warnings.push(m) };
    const runId = startImportRun(db, importer.source);
    try {
      const out = await importer.run(ctx);
      const stats = upsertUsageRecords(db, out.records);
      const removed = importer.fullSnapshot ? removeStaleRecords(db, importer.source, out.records.map((r) => r.externalId)) : 0;
      const result = { ...stats, fetched: out.fetched, skipped: out.skipped, removed };
      finishImportRun(db, runId, result);
      summaries.push({
        source: importer.source, label: importer.label, status: "ok", ...result,
        unassigned: out.records.filter((r) => r.projectCode === null).length, warnings,
      });
    } catch (err) {
      failImportRun(db, runId, err);
      summaries.push({
        source: importer.source, label: importer.label, status: "failed", fetched: 0, inserted: 0, updated: 0,
        unchanged: 0, skipped: 0, removed: 0, unassigned: 0, warnings, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summaries;
}
