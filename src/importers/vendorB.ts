import fs from "node:fs";
import { parseCsv } from "../normalize/csv";
import { parseUsdAmount, usdToIdr } from "../normalize/money";
import { parseDmyDashUtc } from "../normalize/time";
import type { UsageRecord } from "../types";
import type { ImportContext, ImportOutput, Importer } from "./types";

/**
 * Vendor B invoice-line CSV. Amounts are USD with inconsistent formatting.
 * The export repeats some lines verbatim; line_id is unique per charge, so a
 * repeated line_id is the same charge and is imported once.
 */
export function vendorBImporter(csvPath: string): Importer {
  return {
    source: "vendor_b",
    label: "Vendor B",
    async run(ctx: ImportContext): Promise<ImportOutput> {
      const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
      const records: UsageRecord[] = [];
      const seen = new Map<string, number>();
      let skipped = 0;
      for (const row of rows) {
        const id = row.line_id;
        if (!id) { ctx.warn(`Vendor B: row without line_id skipped`); skipped++; continue; }
        const usd = parseUsdAmount(row.usd_amount);
        const prev = seen.get(id);
        if (prev !== undefined) {
          if (prev !== usd) ctx.warn(`Vendor B: line_id ${id} repeated with a different amount (${prev} vs ${usd}); keeping the first`);
          skipped++;
          continue;
        }
        seen.set(id, usd);
        records.push({
          source: "vendor_b",
          externalId: id,
          vendor: "Vendor B",
          item: row.product,
          projectLabel: row.workspace,
          projectCode: ctx.projects.resolve(row.workspace),
          occurredAtUtc: parseDmyDashUtc(row.time_utc),
          originalAmount: usd,
          originalCurrency: "USD",
          amountIdr: usdToIdr(usd, ctx.rates),
        });
      }
      return { records, fetched: rows.length, skipped };
    },
  };
}
