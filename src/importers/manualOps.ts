import crypto from "node:crypto";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { parseIdrAmount } from "../normalize/money";
import { parseManualDateWib, toWibDate } from "../normalize/time";
import type { UsageRecord } from "../types";
import type { ImportContext, ImportOutput, Importer } from "./types";

/**
 * The hand-maintained ops spreadsheet. Rules, all read off the data:
 * - Title row, header on row 3, blank spacers and a TOTAL row to skip.
 * - Dates are WIB calendar days in several formats; amounts are IDR, "Rp 1.850.000" or bare.
 * - "Vendor A" rows are hand copies of vendor_a.csv charges and are skipped.
 * - No row id: invoice number + project + vendor + amount + date identifies a row, so a
 *   twice-typed invoice imports once.
 * - fullSnapshot: a row edited or deleted in the sheet is removed on the next import.
 */
export function manualOpsImporter(xlsxPath: string, opts: { automatedVendors?: string[] } = {}): Importer {
  const automated = new Set((opts.automatedVendors ?? ["Vendor A"]).map((v) => v.toLowerCase()));
  return {
    source: "manual_ops",
    label: "Spreadsheet manual",
    fullSnapshot: true,
    async run(ctx: ImportContext): Promise<ImportOutput> {
      const wb = XLSX.read(fs.readFileSync(xlsxPath), { type: "buffer", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });

      const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim().toLowerCase() === "tanggal");
      if (headerIdx < 0) throw new Error("manual_ops.xlsx: could not find the 'Tanggal' header row");

      const records: UsageRecord[] = [];
      const seen = new Set<string>();
      let fetched = 0;
      let skipped = 0;

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const [date, project, vendor, description, amount, ref] = rows[i] as unknown[];
        const desc = String(description ?? "").trim();
        if (desc.toUpperCase() === "TOTAL" || (date == null && project == null && vendor == null)) continue;
        fetched++;
        const vendorName = String(vendor ?? "").trim();
        if (automated.has(vendorName.toLowerCase())) {
          skipped++;
          continue;
        }
        const projectLabel = String(project ?? "").trim();
        const occurredAtUtc = parseManualDateWib(date);
        const amountIdr = parseIdrAmount(amount as string | number);
        const invoice = /INV-\d+/i.exec(desc)?.[0].toUpperCase() ?? "";
        const refStr = String(ref ?? "").trim();

        const projectCode = ctx.projects.resolve(projectLabel);
        // Key on the resolved project so "snj04" and "SNJ-04" typed for the same invoice collapse to one record.
        const keyParts = [toWibDate(occurredAtUtc), projectCode ?? projectLabel.toLowerCase(), vendorName.toLowerCase(), invoice || desc.toLowerCase(), amountIdr, refStr];
        const key = keyParts.join("|");
        if (seen.has(key)) {
          ctx.warn(`Manual sheet row ${i + 1}: duplicate of an earlier row (${vendorName}, ${invoice || desc}, ${amountIdr}) skipped`);
          skipped++;
          continue;
        }
        seen.add(key);

        records.push({
          source: "manual_ops",
          externalId: "sha1:" + crypto.createHash("sha1").update(key).digest("hex").slice(0, 16),
          vendor: vendorName,
          item: desc,
          projectLabel,
          projectCode,
          occurredAtUtc,
          originalAmount: amountIdr,
          originalCurrency: "IDR",
          amountIdr,
        });
      }
      return { records, fetched, skipped };
    },
  };
}
