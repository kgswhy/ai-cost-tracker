import type { ExportRow } from "../db/queries";

const COLUMNS: [string, (r: ExportRow) => string | number | null][] = [
  ["project_code", (r) => r.projectCode],
  ["project_label", (r) => r.projectLabel],
  ["source", (r) => r.source],
  ["vendor", (r) => r.vendor],
  ["item", (r) => r.item],
  ["occurred_at_wib", (r) => r.occurredAtWib],
  ["week_start_wib", (r) => r.weekStartWib],
  ["original_amount", (r) => r.originalAmount],
  ["original_currency", (r) => r.originalCurrency],
  ["amount_idr", (r) => r.amountIdr],
  ["refund_of", (r) => r.refundOf],
  ["external_id", (r) => r.externalId],
];

function cell(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The normalised records as finance expects them: one row per charge, IDR already converted, CRLF line endings. */
export function recordsToCsv(rows: ExportRow[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(",")];
  for (const r of rows) lines.push(COLUMNS.map(([, get]) => cell(get(r))).join(","));
  return lines.join("\r\n") + "\r\n";
}
