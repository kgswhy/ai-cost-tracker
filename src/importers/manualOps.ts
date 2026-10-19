import crypto from "node:crypto";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { parseIdrAmount } from "../normalize/money.js";
import { parseManualDateWib, toWibDate } from "../normalize/time.js";
import type { UsageRecord } from "../types.js";
import type { ImportContext, ImportOutput, Importer } from "./types.js";

/**
 * The hand-maintained ops spreadsheet. Rules, all discovered from the data:
 *
 * - Row 1 is a title, row 3 the header, then one row per expense; blank
 *   spacer rows and a final TOTAL row are ignored.
 * - Dates are typed by hand in local time (WIB) in several formats.
 * - Amounts are IDR, sometimes "Rp 1.850.000", sometimes a bare number.
 * - Rows whose vendor is "Vendor A" are the ops team's manual copies of
 *   charges that already arrive through vendor_a.csv (most carry the TXN ref;
 *   the rest match on credits x rate and date). They are skipped so the
 *   automated feed is the single source for Vendor A.
 * - The sheet has no row id. The invoice number in the description, with
 *   project, vendor, amount and date, identifies an expense; the same
 *   invoice typed twice (it happens) is imported once.
 * - The sheet is the whole truth for its own rows: a row that is edited or
 *   deleted in the sheet is removed from the database on the next import
 *   (see fullSnapshot), so a typo fix does not leave a ghost record behind.
 */
export function manualOpsImporter(xlsxPath: string, opts: { automatedVendors?: string[] } = {}): Importer {
  const automated = new Set((opts.automatedVendors ?? ["Vendor A"]).map((v) => v.toLowerCase()));
  return {
    source: "manual_ops",
    label: "Manual ops sheet",
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
