import { getDb } from "@/src/db/connection";
import { config } from "@/src/config";
import {
  allRecords, importRunHistory, latestImportRuns, latestRecordWib, latestWeekStart, projectRecords, projectSpend, projectWeekly, recentAlerts, totals,
  unassignedGroups, unassignedRecords, vendorByProject, vendorSpend, weeklySpend,
} from "@/src/db/queries";
import { computePace, type Pace } from "@/src/analysis/pace";
import { findOutliers, type OutlierVerdict } from "@/src/analysis/outliers";
import { listUserAliases } from "@/src/db/index";
import { loadReferenceData } from "@/src/importers/index";
import { resolveSourceFile, SOURCE_FILES, type FileSource } from "@/src/importers/files";
import { pendingAlerts } from "@/src/alerts/index";

export function dashboardData() {
  const db = getDb();
  const weekly = weeklySpend(db);
  const latestWeek = latestWeekStart(db);
  // Most urgent first: the dashboard exists to answer "which project is about to run over".
  const projects = projectSpend(db)
    .map((p) => ({ ...p, pace: computePace(weekly.filter((w) => w.projectCode === p.code), p.budgetIdr, p.spendIdr, latestWeek) }))
    .sort((a, b) => b.pctUsed - a.pctUsed);
  const records = allRecords(db);
  const verdicts = findOutliers(records);
  const outliers = records
    .filter((r) => verdicts.get(r)?.isOutlier)
    .map((r) => ({ ...r, verdict: verdicts.get(r)! }))
    .sort((a, b) => b.amountIdr - a.amountIdr);
  const importRuns = latestImportRuns(db);
  const groups = unassignedGroups(db);
  const webhook = Boolean(config.alerts.webhookUrl);
  const checklist = {
    lastImportAt: importRuns.length ? importRuns.map((r) => r.startedAt).sort().at(-1)! : null,
    sourcesOk: importRuns.filter((r) => r.status === "ok").length,
    sourcesFailed: importRuns.filter((r) => r.status !== "ok").map((r) => r.source),
    sourcesTotal: 4,
    newestRecordWib: latestRecordWib(db),
    labelsWaiting: groups.length,
    webhookConfigured: webhook,
    alertsPending: pendingAlerts(db, config.alerts.thresholds, webhook).length,
    alertsSent: recentAlerts(db).length,
  };
  return {
    totals: totals(db),
    projects,
    outliers,
    checklist,
    vendors: vendorSpend(db),
    vendorByProject: vendorByProject(db),
    weekly,
    unassignedCount: unassignedRecords(db).length,
    importRuns,
    alerts: recentAlerts(db),
    thresholds: config.alerts.thresholds,
  };
}

export function projectData(code: string) {
  const db = getDb();
  const project = projectSpend(db).find((p) => p.code === code);
  if (!project) return null;
  const weekly = projectWeekly(db, code);
  const pace: Pace = computePace(weekly, project.budgetIdr, project.spendIdr, latestWeekStart(db));
  // Medians come from every record, not just this project's, so a lone big charge still has peers to compare with.
  const verdicts = findOutliers(allRecords(db));
  const byId = new Map<number, OutlierVerdict>();
  for (const [r, v] of verdicts) if (v.isOutlier) byId.set(r.id, v);
  return {
    project,
    pace,
    vendors: vendorSpend(db, code),
    weekly,
    records: projectRecords(db, code).map((r) => ({ ...r, outlier: byId.get(r.id) ?? null })),
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
