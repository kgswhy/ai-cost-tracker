import type { Db } from "./index";

export interface ProjectSpend {
  code: string;
  name: string;
  client: string;
  budgetIdr: number;
  spendIdr: number;
  pctUsed: number;
  recordCount: number;
}

export function projectSpend(db: Db): ProjectSpend[] {
  const rows = db.prepare(
    `SELECT p.code, p.name, p.client, p.budget_idr AS budgetIdr,
            COALESCE(SUM(u.amount_idr), 0) AS spendIdr, COUNT(u.id) AS recordCount
     FROM projects p LEFT JOIN usage_records u ON u.project_code = p.code
     GROUP BY p.code ORDER BY p.code`,
  ).all() as Omit<ProjectSpend, "pctUsed">[];
  return rows.map((r) => ({ ...r, pctUsed: r.budgetIdr > 0 ? (r.spendIdr / r.budgetIdr) * 100 : 0 }));
}

export interface VendorSpend { vendor: string; spendIdr: number; recordCount: number }

export function vendorSpend(db: Db, projectCode?: string): VendorSpend[] {
  return db.prepare(
    `SELECT vendor, SUM(amount_idr) AS spendIdr, COUNT(*) AS recordCount
     FROM usage_records WHERE (@code IS NULL OR project_code = @code)
     GROUP BY vendor ORDER BY spendIdr DESC`,
  ).all({ code: projectCode ?? null }) as VendorSpend[];
}

export interface VendorByProject { projectCode: string | null; vendor: string; spendIdr: number }

export function vendorByProject(db: Db): VendorByProject[] {
  return db.prepare(
    `SELECT project_code AS projectCode, vendor, SUM(amount_idr) AS spendIdr
     FROM usage_records GROUP BY project_code, vendor`,
  ).all() as VendorByProject[];
}

export interface WeeklySpend { weekStart: string; projectCode: string | null; spendIdr: number }

export function weeklySpend(db: Db): WeeklySpend[] {
  return db.prepare(
    `SELECT week_start_wib AS weekStart, project_code AS projectCode, SUM(amount_idr) AS spendIdr
     FROM usage_records GROUP BY week_start_wib, project_code ORDER BY week_start_wib`,
  ).all() as WeeklySpend[];
}

export interface UnassignedRecord {
  source: string; externalId: string; vendor: string; item: string; projectLabel: string;
  occurredAtWib: string; amountIdr: number;
}

export function unassignedRecords(db: Db): UnassignedRecord[] {
  return db.prepare(
    `SELECT source, external_id AS externalId, vendor, item, project_label AS projectLabel,
            occurred_at_wib AS occurredAtWib, amount_idr AS amountIdr
     FROM usage_records WHERE project_code IS NULL ORDER BY occurred_at_utc DESC`,
  ).all() as UnassignedRecord[];
}

export interface ImportRunRow {
  id: number; source: string; startedAt: string; finishedAt: string | null; status: string;
  fetched: number; inserted: number; updated: number; unchanged: number; skipped: number; removed: number; error: string | null;
}

export function latestImportRuns(db: Db): ImportRunRow[] {
  return db.prepare(
    `SELECT id, source, started_at AS startedAt, finished_at AS finishedAt, status, fetched, inserted, updated, unchanged, skipped, removed, error
     FROM import_runs r WHERE id = (SELECT MAX(id) FROM import_runs WHERE source = r.source) ORDER BY source`,
  ).all() as ImportRunRow[];
}

export interface AlertRow {
  projectCode: string; thresholdPct: number; spendIdr: number; budgetIdr: number; pctUsed: number; delivery: string; sentAt: string;
}

export function recentAlerts(db: Db): AlertRow[] {
  return db.prepare(
    `SELECT project_code AS projectCode, threshold_pct AS thresholdPct, spend_idr AS spendIdr, budget_idr AS budgetIdr,
            pct_used AS pctUsed, delivery, sent_at AS sentAt
     FROM budget_alerts ORDER BY sent_at DESC`,
  ).all() as AlertRow[];
}

export function totals(db: Db): { spendIdr: number; budgetIdr: number; recordCount: number; unassignedIdr: number } {
  const spend = db.prepare(`SELECT COALESCE(SUM(amount_idr),0) AS s, COUNT(*) AS n FROM usage_records`).get() as { s: number; n: number };
  const budget = db.prepare(`SELECT COALESCE(SUM(budget_idr),0) AS b FROM projects`).get() as { b: number };
  const un = db.prepare(`SELECT COALESCE(SUM(amount_idr),0) AS s FROM usage_records WHERE project_code IS NULL`).get() as { s: number };
  return { spendIdr: spend.s, budgetIdr: budget.b, recordCount: spend.n, unassignedIdr: un.s };
}

export interface UnassignedGroup { label: string; recordCount: number; spendIdr: number; sources: string; lastSeenWib: string }

/** Unlinked records grouped by the label as typed, so one alias fixes a whole group. */
export function unassignedGroups(db: Db): UnassignedGroup[] {
  return db.prepare(
    `SELECT project_label AS label, COUNT(*) AS recordCount, SUM(amount_idr) AS spendIdr,
            GROUP_CONCAT(DISTINCT source) AS sources, MAX(occurred_at_wib) AS lastSeenWib
     FROM usage_records WHERE project_code IS NULL
     GROUP BY project_label ORDER BY spendIdr DESC`,
  ).all() as UnassignedGroup[];
}

export interface RecordRow {
  id: number; source: string; externalId: string; vendor: string; item: string; projectLabel: string;
  occurredAtWib: string; originalAmount: number; originalCurrency: string; amountIdr: number; refundOf: string | null;
}

export function projectRecords(db: Db, code: string): RecordRow[] {
  return db.prepare(
    `SELECT id, source, external_id AS externalId, vendor, item, project_label AS projectLabel, occurred_at_wib AS occurredAtWib,
            original_amount AS originalAmount, original_currency AS originalCurrency, amount_idr AS amountIdr, refund_of AS refundOf
     FROM usage_records WHERE project_code = ? ORDER BY occurred_at_utc DESC`,
  ).all(code) as RecordRow[];
}

export function projectWeekly(db: Db, code: string): { weekStart: string; spendIdr: number }[] {
  return db.prepare(
    `SELECT week_start_wib AS weekStart, SUM(amount_idr) AS spendIdr FROM usage_records WHERE project_code = ? GROUP BY week_start_wib ORDER BY week_start_wib`,
  ).all(code) as { weekStart: string; spendIdr: number }[];
}

export function importRunHistory(db: Db, limit = 40): (ImportRunRow & { warnings: string[] })[] {
  const rows = db.prepare(
    `SELECT id, source, started_at AS startedAt, finished_at AS finishedAt, status, fetched, inserted, updated, unchanged, skipped, removed, warnings, error
     FROM import_runs ORDER BY id DESC LIMIT ?`,
  ).all(limit) as (ImportRunRow & { warnings: string | null })[];
  return rows.map((r) => ({ ...r, warnings: r.warnings ? (JSON.parse(r.warnings) as string[]) : [] }));
}

/** Monday of the most recent WIB week with any record, across every project. */
export function latestWeekStart(db: Db): string | null {
  const row = db.prepare(`SELECT MAX(week_start_wib) AS w FROM usage_records`).get() as { w: string | null };
  return row.w;
}

export type ExportRow = RecordRow & { projectCode: string | null; occurredAtUtc: string; weekStartWib: string };

export function allRecords(db: Db, projectCode?: string): ExportRow[] {
  return db.prepare(
    `SELECT id, source, external_id AS externalId, vendor, item, project_label AS projectLabel, project_code AS projectCode,
            occurred_at_utc AS occurredAtUtc, occurred_at_wib AS occurredAtWib, week_start_wib AS weekStartWib,
            original_amount AS originalAmount, original_currency AS originalCurrency, amount_idr AS amountIdr, refund_of AS refundOf
     FROM usage_records WHERE (@code IS NULL OR project_code = @code) ORDER BY occurred_at_utc DESC`,
  ).all({ code: projectCode ?? null }) as ExportRow[];
}

/** WIB timestamp of the newest transaction, or null when the table is empty. */
export function latestRecordWib(db: Db): string | null {
  const row = db.prepare(`SELECT MAX(occurred_at_wib) AS t FROM usage_records`).get() as { t: string | null };
  return row.t;
}
