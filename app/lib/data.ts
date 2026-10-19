import { getDb } from "@/src/db/connection";
import { config } from "@/src/config";
import {
  importRunHistory, latestImportRuns, projectRecords, projectSpend, projectWeekly, recentAlerts, totals,
  unassignedGroups, unassignedRecords, vendorByProject, vendorSpend, weeklySpend,
} from "@/src/db/queries";
import { listUserAliases } from "@/src/db/index";
import { loadReferenceData } from "@/src/importers/index";
import { resolveSourceFile, SOURCE_FILES, type FileSource } from "@/src/importers/files";
import { pendingAlerts } from "@/src/alerts/index";

export function dashboardData() {
  const db = getDb();
  return {
    totals: totals(db),
    projects: projectSpend(db),
    vendors: vendorSpend(db),
    vendorByProject: vendorByProject(db),
    weekly: weeklySpend(db),
    unassignedCount: unassignedRecords(db).length,
    importRuns: latestImportRuns(db),
    alerts: recentAlerts(db),
    thresholds: config.alerts.thresholds,
  };
}

export function projectData(code: string) {
  const db = getDb();
  const project = projectSpend(db).find((p) => p.code === code);
  if (!project) return null;
  return {
    project,
    vendors: vendorSpend(db, code),
    weekly: projectWeekly(db, code),
    records: projectRecords(db, code),
    thresholds: config.alerts.thresholds,
  };
}

export function importPageData() {
  const db = getDb();
  const files = (Object.keys(SOURCE_FILES) as FileSource[]).map((source) => ({ source, ...SOURCE_FILES[source], file: resolveSourceFile(source) }));
  return {
    files,
    vendorC: { baseUrl: config.vendorC.baseUrl, keyConfigured: Boolean(config.vendorC.apiKey) },
    latest: latestImportRuns(db),
    history: importRunHistory(db, 40),
  };
}

export function reviewPageData() {
  const db = getDb();
  const { projects, aliases } = loadReferenceData(db);
  return {
    groups: unassignedGroups(db),
    projects,
    userAliases: listUserAliases(db),
    configAliasCount: Object.entries(aliases).filter(([k]) => !k.startsWith("_")).reduce((n, [, v]) => n + v.length, 0),
  };
}

export function alertsPageData() {
  const db = getDb();
  const webhook = config.alerts.webhookUrl;
  return {
    thresholds: config.alerts.thresholds,
    webhookConfigured: Boolean(webhook),
    webhookHost: webhook ? safeHost(webhook) : null,
    pending: pendingAlerts(db, config.alerts.thresholds, Boolean(webhook)),
    sent: recentAlerts(db),
    projects: projectSpend(db),
  };
}

function safeHost(url: string): string {
  try { return new URL(url).host; } catch { return "(invalid URL)"; }
}
