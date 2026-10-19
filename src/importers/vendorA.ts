import fs from "node:fs";
import { parseExport } from "../normalize/csv";
import { creditsToIdr } from "../normalize/money";
import { parseUsSlashUtc } from "../normalize/time";
import type { UsageRecord } from "../types";
import type { ImportContext, ImportOutput, Importer } from "./types";

/**
 * Vendor A CSV export. Amounts are credits. Refund rows carry a negative
 * credit amount and point at the original charge via ref_transaction_id; we
 * keep them as negative records so per-project spend is net of refunds and
 * the original charge still shows in the audit trail.
 */
export function vendorAImporter(csvPath: string): Importer {
  return {
    source: "vendor_a",
    label: "Vendor A",
    async run(ctx: ImportContext): Promise<ImportOutput> {
      const rows = parseExport(fs.readFileSync(csvPath, "utf8"), "Vendor A", ["transaction_id", "timestamp_utc", "project_tag", "model", "job_type", "credits"]);
      const records: UsageRecord[] = [];
      const seen = new Set<string>();
      let skipped = 0;
      for (const row of rows) {
        const id = row.transaction_id;
        if (!id) { ctx.warn(`Vendor A: row without transaction_id skipped`); skipped++; continue; }
        if (seen.has(id)) { ctx.warn(`Vendor A: duplicate transaction_id ${id} skipped`); skipped++; continue; }
        seen.add(id);
        const credits = Number(row.credits);
        if (!Number.isFinite(credits)) throw new Error(`Transaksi ${id} di file Vendor A: kolom credits berisi "${row.credits}", bukan angka. Perbaiki baris itu atau ambil ulang export-nya.`);
        const isRefund = row.job_type === "refund" || credits < 0;
        records.push({
          source: "vendor_a",
          externalId: id,
          vendor: "Vendor A",
          item: isRefund ? `refund (${row.model})` : `${row.job_type} (${row.model})`,
          projectLabel: row.project_tag,
          projectCode: ctx.projects.resolve(row.project_tag),
          occurredAtUtc: parseUsSlashUtc(row.timestamp_utc),
          originalAmount: credits,
          originalCurrency: "CREDIT",
          amountIdr: creditsToIdr(credits, ctx.rates),
          refundOf: row.ref_transaction_id || null,
        });
      }
      return { records, fetched: rows.length, skipped };
    },
  };
}
