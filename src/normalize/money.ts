import type { Rates } from "../types.js";

/**
 * Vendor B amounts come in as 13.21, "$70.9", "$1,036.15". Strip the symbol and
 * US thousands separators, keep the decimal point.
 */
export function parseUsdAmount(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new Error(`Unrecognized USD amount: "${raw}"`);
  return Number(cleaned);
}

/**
 * Manual spreadsheet amounts come in as 350000, "Rp 1.850.000", "47.040",
 * "1.000.000". Indonesian formatting uses "." as the thousands separator and
 * the sheet never uses fractional rupiah, so every "." is a thousands separator.
 */
export function parseIdrAmount(raw: string | number): number {
  if (typeof raw === "number") return Math.round(raw);
  const cleaned = raw.trim().replace(/^rp\.?\s*/i, "").replace(/\./g, "").replace(/\s/g, "");
  if (!/^-?\d+$/.test(cleaned)) throw new Error(`Unrecognized IDR amount: "${raw}"`);
  return Number(cleaned);
}

export function creditsToIdr(credits: number, rates: Rates): number {
  return Math.round(credits * rates.credit_to_idr);
}

export function usdToIdr(usd: number, rates: Rates): number {
  return Math.round(usd * rates.usd_to_idr);
}

export function usdCentsToIdr(cents: number, rates: Rates): number {
  return Math.round((cents / 100) * rates.usd_to_idr);
}

export function formatIdr(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
