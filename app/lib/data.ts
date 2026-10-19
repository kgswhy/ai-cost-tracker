import { cache } from "react";
import { getDb } from "@/src/db/connection";
import { config } from "@/src/config";
import {
  allRecords, earliestRecordWib, importRunHistory, latestImportRuns, latestRecordWib, latestWeekStart, projectRecords, projectSpend, projectWeekly,
  recentAlerts, totals, unassignedGroups, unassignedRecords, vendorSpend, weeklySpend, type ExportRow,
} from "@/src/db/queries";
import { computePace } from "@/src/analysis/pace";
import { findOutliers, type OutlierVerdict } from "@/src/analysis/outliers";
import { listReviewedLabels, listUserAliases, type Db } from "@/src/db/index";
import { loadReferenceData } from "@/src/importers/index";
import { resolveSourceFile, SOURCE_FILES, type FileSource } from "@/src/importers/files";
import { formatAlertMessage, pendingAlerts } from "@/src/alerts/index";
import { normalizeLabel } from "@/src/normalize/project";
import { configuredWebhook } from "@/src/alerts/run";
import { detectProvider, maskWebhookUrl } from "@/src/alerts/webhook";

export type Outlier = ExportRow & { verdict: OutlierVerdict };

/**
 * Charges at least 8x the usual amount for their vendor and item, biggest first.
 * The sidebar and the page both need this, so it is computed once per request.
 */
const outliersOf = cache((db: Db): Outlier[] => {
  const records = allRecords(db);
  const verdicts = findOutliers(records);
  return records
    .filter((r) => verdicts.get(r)?.isOutlier)
    .map((r) => ({ ...r, verdict: verdicts.get(r)! }))
    .sort((a, b) => b.amountIdr - a.amountIdr);
});

/** Unlinked names nobody has looked at yet: reviewed ones ("not a project") drop off the list. */
function waitingGroups(db: Db) {
  const reviewed = new Set(listReviewedLabels(db).map((r) => r.label));
  return unassignedGroups(db).filter((g) => !reviewed.has(normalizeLabel(g.label)) || g.label.trim() === "");
}

/** Projects with spend, pace and, where an unusual charge sits in them, the share without it. */
function projectsWithPace(db: Db, outliers: Outlier[]) {
  const weekly = weeklySpend(db);
  const latestWeek = latestWeekStart(db);
  const outlierIdr = new Map<string, number>();
  for (const o of outliers) if (o.projectCode) outlierIdr.set(o.projectCode, (outlierIdr.get(o.projectCode) ?? 0) + o.amountIdr);
  return projectSpend(db).map((p) => {
    const flagged = outlierIdr.get(p.code) ?? 0;
    return {
      ...p,
      pace: computePace(weekly.filter((w) => w.projectCode === p.code), p.budgetIdr, p.spendIdr, latestWeek),
      flaggedIdr: flagged,
      pctWithoutFlagged: flagged && p.budgetIdr ? ((p.spendIdr - flagged) / p.budgetIdr) * 100 : null,
    };
  });
}

/** Everything the sidebar shows on every page. */
export function shellData() {
  const db = getDb();
  const runs = latestImportRuns(db);
  const webhook = Boolean(configuredWebhook(db));
  const projects = projectSpend(db);
  return {
    thresholds: config.alerts.thresholds,
    projects: projects.map((p) => ({ code: p.code, client: p.client, pctUsed: p.pctUsed })),
    namesWaiting: waitingGroups(db).filter((g) => g.label.trim() !== "").length,
    outliers: outliersOf(db).length,
    alertsPending: pendingAlerts(db, config.alerts.thresholds, webhook).length,
    lastImport: runs.length
      ? {
          at: runs.map((r) => r.startedAt).sort().at(-1)!,
          failed: runs.filter((r) => r.status !== "ok").map((r) => r.source),
          inserted: runs.reduce((s, r) => s + r.inserted, 0),
          unchanged: runs.reduce((s, r) => s + r.unchanged, 0),
          updated: runs.reduce((s, r) => s + r.updated, 0),
        }
      : null,
  };
}

export function dashboardData() {
  const db = getDb();
  const outliers = outliersOf(db);
  const projects = projectsWithPace(db, outliers).sort((a, b) => b.pctUsed - a.pctUsed);
  const t = totals(db);
  const projectSpendIdr = t.spendIdr - t.unassignedIdr;

  const flaggedByVendor = new Map<string, number>();
  for (const o of outliers) flaggedByVendor.set(o.vendor, (flaggedByVendor.get(o.vendor) ?? 0) + o.amountIdr);
  const flaggedByWeek = new Map<string, number>();
  for (const o of outliers) flaggedByWeek.set(o.weekStartWib, (flaggedByWeek.get(o.weekStartWib) ?? 0) + o.amountIdr);
  const weekTotals = new Map<string, number>();
  for (const w of weeklySpend(db)) weekTotals.set(w.weekStart, (weekTotals.get(w.weekStart) ?? 0) + w.spendIdr);

  const groups = waitingGroups(db).filter((g) => g.label.trim() !== "");
  return {
    hasData: t.recordCount > 0,
    firstDay: earliestRecordWib(db),
    lastDay: latestRecordWib(db),
    totals: { ...t, projectSpendIdr },
    projects,
    outliers,
    namesWaiting: groups.length,
    vendors: vendorSpend(db).map((v) => ({ ...v, flaggedIdr: flaggedByVendor.get(v.vendor) ?? 0 })),
    weeks: [...weekTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, spendIdr]) => ({ weekStart, spendIdr, flaggedIdr: flaggedByWeek.get(weekStart) ?? 0 })),
    thresholds: config.alerts.thresholds,
  };
}

export function chargesData() {
  const db = getDb();
  const outliers = outliersOf(db);
  const projects = projectsWithPace(db, outliers);
  return { outliers, projects, thresholds: config.alerts.thresholds };
}

export function projectData(code: string) {
  const db = getDb();
  const outliers = outliersOf(db);
  const project = projectsWithPace(db, outliers).find((p) => p.code === code);
  if (!project) return null;
  const flaggedIds = new Map(outliers.map((o) => [o.id, o.verdict]));
  return {
    project,
    vendors: vendorSpend(db, code),
    weekly: projectWeekly(db, code),
    records: projectRecords(db, code).map((r) => ({ ...r, outlier: flaggedIds.get(r.id) ?? null })),
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
  const { projects } = loadReferenceData(db);
  const unlinked = unassignedRecords(db);
  const groups = waitingGroups(db).map((g) => ({
    ...g,
    rows: unlinked.filter((r) => r.projectLabel === g.label),
  }));
  return {
    groups,
    totalIdr: unlinked.reduce((s, r) => s + r.amountIdr, 0),
    totalCount: unlinked.length,
    projects,
    userAliases: listUserAliases(db),
    reviewed: listReviewedLabels(db),
  };
}

export function alertsPageData(selected?: string) {
  const db = getDb();
  const hook = configuredWebhook(db);
  const webhook = hook?.url ?? "";
  const projects = new Map(projectSpend(db).map((p) => [p.code, p]));
  const sent = recentAlerts(db).map((a) => {
    const p = projects.get(a.projectCode);
    const message = formatAlertMessage({
      projectCode: a.projectCode, projectName: p?.name ?? a.projectCode, client: p?.client ?? "", thresholdPct: a.thresholdPct,
      spendIdr: a.spendIdr, budgetIdr: a.budgetIdr, pctUsed: a.pctUsed,
    });
    return { ...a, key: `${a.projectCode}-${a.thresholdPct}`, message };
  });
  return {
    thresholds: config.alerts.thresholds,
    webhookConfigured: Boolean(webhook),
    // Only the host and the last characters leave the server: the full URL is a secret.
    webhook: hook ? { provider: detectProvider(hook.url), masked: maskWebhookUrl(hook.url), origin: hook.origin } : null,
    envFallback: Boolean(config.alerts.webhookUrl),
    pending: pendingAlerts(db, config.alerts.thresholds, Boolean(webhook)),
    sent,
    current: sent.find((a) => a.key === selected) ?? sent[0] ?? null,
    projectsSent: new Set(sent.map((a) => a.projectCode)).size,
  };
}
