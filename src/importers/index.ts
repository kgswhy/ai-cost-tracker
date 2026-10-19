import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { countRecords, finishImportRun, failImportRun, listUserAliases, openDatabase, removeStaleRecords, startImportRun, upsertProjects, upsertUsageRecords, type Db } from "../db/index";
import { resolveSourceFile } from "./files";
import { createProjectResolver, loadAliases, loadProjectsCsv } from "../normalize/project";
import type { Rates } from "../types";
import { manualOpsImporter } from "./manualOps";
import type { ImportContext, Importer } from "./types";
import { vendorAImporter } from "./vendorA";
import { vendorBImporter } from "./vendorB";
import { vendorCImporter } from "./vendorC";

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
  return [
    vendorAImporter(resolveSourceFile("vendor_a").path),
    vendorBImporter(resolveSourceFile("vendor_b").path),
    vendorCImporter({ baseUrl: config.vendorC.baseUrl, apiKey: config.vendorC.apiKey }),
    manualOpsImporter(resolveSourceFile("manual_ops").path),
  ];
}

/** projects.csv, rates.json and the alias file, plus aliases added from the dashboard. */
export function loadReferenceData(db?: Db) {
  const rates = JSON.parse(fs.readFileSync(path.join(config.dataDir, "rates.json"), "utf8")) as Rates;
  const projects = loadProjectsCsv(path.join(config.dataDir, "projects.csv"));
  const aliases = loadAliases(path.join(config.rootDir, "config", "project_aliases.json"));
  const userAliases = db ? listUserAliases(db) : [];
  return { rates, projects, aliases, resolver: createProjectResolver(projects, aliases, userAliases) };
}

/**
 * Runs every importer against the database. Each source is its own
 * transaction and its own import_runs row, so one vendor being down does not
 * block the others. Returns a per-source summary for the CLI and dashboard.
 */
export async function runImport(opts: { db?: Db; importers?: Importer[]; only?: string[] } = {}): Promise<SourceSummary[]> {
  const db = opts.db ?? openDatabase(config.databasePath);
  const { rates, projects } = loadReferenceData();
  upsertProjects(db, projects);
  const { resolver } = loadReferenceData(db);

  const importers = (opts.importers ?? defaultImporters()).filter((i) => !opts.only || opts.only.includes(i.source));
  const summaries: SourceSummary[] = [];

  for (const importer of importers) {
    const warnings: string[] = [];
    const ctx: ImportContext = { rates, projects: resolver, warn: (m) => warnings.push(m) };
    const runId = startImportRun(db, importer.source);
    try {
      const out = await importer.run(ctx);
      // A full snapshot replaces what is stored, so an empty one would wipe the source; treat it as a bad file instead.
      if (importer.fullSnapshot && out.records.length === 0 && countRecords(db, importer.source) > 0) {
        throw new Error(`${importer.label} tidak berisi satu pun baris pengeluaran, jadi data lama tidak dihapus. Periksa apakah file dan sheet pertamanya benar.`);
      }
      const stats = upsertUsageRecords(db, out.records);
      const removed = importer.fullSnapshot ? removeStaleRecords(db, importer.source, out.records.map((r) => r.externalId)) : 0;
      const result = { ...stats, fetched: out.fetched, skipped: out.skipped, removed, warnings };
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
