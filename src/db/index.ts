import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Project, UsageRecord } from "../types.js";
import { toWibString, toWibWeekStart } from "../normalize/time.js";

export type Db = Database.Database;

export function openDatabase(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(import.meta.dirname, "schema.sql"), "utf8"));
  return db;
}

export function upsertProjects(db: Db, projects: Project[]): void {
  const stmt = db.prepare(
    `INSERT INTO projects (code, name, client, budget_idr) VALUES (@code, @name, @client, @budgetIdr)
     ON CONFLICT(code) DO UPDATE SET name = excluded.name, client = excluded.client, budget_idr = excluded.budget_idr`,
  );
  db.transaction(() => projects.forEach((p) => stmt.run(p)))();
}

export interface UpsertStats { inserted: number; updated: number; unchanged: number }

/**
 * Idempotent write. A record is identified by (source, external_id); running
 * the same import twice leaves the table unchanged, while a corrected value at
 * the source (or a new alias mapping) updates the existing row in place.
 */
export function upsertUsageRecords(db: Db, records: UsageRecord[]): UpsertStats {
  const now = new Date().toISOString();
  const find = db.prepare(
    `SELECT vendor, item, project_label, project_code, occurred_at_utc, original_amount, original_currency, amount_idr, refund_of
     FROM usage_records WHERE source = ? AND external_id = ?`,
  );
  const insert = db.prepare(
    `INSERT INTO usage_records (source, external_id, vendor, item, project_label, project_code, occurred_at_utc, occurred_at_wib,
       week_start_wib, original_amount, original_currency, amount_idr, refund_of, first_seen_at, last_seen_at)
     VALUES (@source, @externalId, @vendor, @item, @projectLabel, @projectCode, @occurredAtUtc, @occurredAtWib,
       @weekStartWib, @originalAmount, @originalCurrency, @amountIdr, @refundOf, @now, @now)`,
  );
  const update = db.prepare(
    `UPDATE usage_records SET vendor = @vendor, item = @item, project_label = @projectLabel, project_code = @projectCode,
       occurred_at_utc = @occurredAtUtc, occurred_at_wib = @occurredAtWib, week_start_wib = @weekStartWib,
       original_amount = @originalAmount, original_currency = @originalCurrency, amount_idr = @amountIdr,
       refund_of = @refundOf, last_seen_at = @now
     WHERE source = @source AND external_id = @externalId`,
  );
  const touch = db.prepare(`UPDATE usage_records SET last_seen_at = ? WHERE source = ? AND external_id = ?`);

  const stats: UpsertStats = { inserted: 0, updated: 0, unchanged: 0 };
  db.transaction(() => {
    for (const r of records) {
      const row = {
        source: r.source,
        externalId: r.externalId,
        vendor: r.vendor,
        item: r.item,
        projectLabel: r.projectLabel,
        projectCode: r.projectCode,
        occurredAtUtc: r.occurredAtUtc.toISOString(),
        occurredAtWib: toWibString(r.occurredAtUtc),
        weekStartWib: toWibWeekStart(r.occurredAtUtc),
        originalAmount: r.originalAmount,
        originalCurrency: r.originalCurrency,
        amountIdr: r.amountIdr,
        refundOf: r.refundOf ?? null,
        now,
      };
      const existing = find.get(r.source, r.externalId) as Record<string, unknown> | undefined;
      if (!existing) { insert.run(row); stats.inserted++; continue; }
      const same =
        existing.vendor === row.vendor && existing.item === row.item && existing.project_label === row.projectLabel &&
        existing.project_code === row.projectCode && existing.occurred_at_utc === row.occurredAtUtc &&
        existing.original_amount === row.originalAmount && existing.original_currency === row.originalCurrency &&
        existing.amount_idr === row.amountIdr && existing.refund_of === row.refundOf;
      if (same) { touch.run(now, r.source, r.externalId); stats.unchanged++; }
      else { update.run(row); stats.updated++; }
    }
  })();
  return stats;
}

/** Deletes records of `source` whose external id is not in `keep`. Used for full-snapshot sources. */
export function removeStaleRecords(db: Db, source: string, keep: string[]): number {
  const keepSet = new Set(keep);
  const rows = db.prepare(`SELECT external_id AS id FROM usage_records WHERE source = ?`).all(source) as { id: string }[];
  const stale = rows.filter((r) => !keepSet.has(r.id)).map((r) => r.id);
  const del = db.prepare(`DELETE FROM usage_records WHERE source = ? AND external_id = ?`);
  db.transaction(() => stale.forEach((id) => del.run(source, id)))();
  return stale.length;
}

export interface ImportRunResult extends UpsertStats { fetched: number; skipped: number; removed: number }

export function startImportRun(db: Db, source: string): number {
  const r = db.prepare(`INSERT INTO import_runs (source, started_at, status) VALUES (?, ?, 'running')`)
    .run(source, new Date().toISOString());
  return Number(r.lastInsertRowid);
}

export function finishImportRun(db: Db, id: number, result: ImportRunResult): void {
  db.prepare(
    `UPDATE import_runs SET finished_at = ?, status = 'ok', fetched = ?, inserted = ?, updated = ?, unchanged = ?, skipped = ?, removed = ? WHERE id = ?`,
  ).run(new Date().toISOString(), result.fetched, result.inserted, result.updated, result.unchanged, result.skipped, result.removed, id);
}

export function failImportRun(db: Db, id: number, error: unknown): void {
  db.prepare(`UPDATE import_runs SET finished_at = ?, status = 'failed', error = ? WHERE id = ?`)
    .run(new Date().toISOString(), error instanceof Error ? error.message : String(error), id);
}
