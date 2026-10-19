/** WIB (Waktu Indonesia Barat) is UTC+7 with no daylight saving. */
export const WIB_OFFSET_MINUTES = 7 * 60;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7,
  aug: 8, agu: 8, agt: 8, sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
};

function utc(y: number, m: number, d: number, hh = 0, mm = 0, ss = 0): Date {
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  // Reject things like 31 Feb that Date.UTC silently rolls over.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`Invalid calendar date ${y}-${m}-${d}`);
  }
  return date;
}

/** Vendor A: "MM/DD/YYYY HH:MM", UTC. */
export function parseUsSlashUtc(s: string): Date {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`Unrecognized Vendor A timestamp: "${s}"`);
  return utc(+m[3], +m[1], +m[2], +m[4], +m[5]);
}

/** Vendor B: "DD-MM-YYYY HH:MM", UTC. */
export function parseDmyDashUtc(s: string): Date {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4}) (\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`Unrecognized Vendor B timestamp: "${s}"`);
  return utc(+m[3], +m[2], +m[1], +m[4], +m[5]);
}

/** Vendor C: ISO 8601 with Z. */
export function parseIsoUtc(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Unrecognized ISO timestamp: "${s}"`);
  return d;
}

/**
 * Manual spreadsheet dates. The ops team types these in local time (WIB), in
 * whatever format they feel like that day:
 *   Excel serial number (45000), "1/9/2026" (D/M/YYYY), "2026-09-04",
 *   "14 Sep 2026", "01 Okt 2026" (Indonesian month names).
 * Returns the UTC instant for midnight WIB of that day.
 */
export function parseManualDateWib(value: unknown): Date {
  if (value instanceof Date) {
    // SheetJS already decoded the serial; it gives a UTC-ish date for the calendar day.
    return wibMidnightToUtc(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    // Excel serial, 1900 date system. Day 0 is 1899-12-30.
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(value) * 86_400_000);
    return wibMidnightToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(value ?? "").trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return wibMidnightToUtc(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) return wibMidnightToUtc(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s))) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) throw new Error(`Unknown month name in manual date: "${s}"`);
    return wibMidnightToUtc(+m[3], month, +m[1]);
  }
  throw new Error(`Unrecognized manual spreadsheet date: "${s}"`);
}

function wibMidnightToUtc(y: number, m: number, d: number): Date {
  return new Date(utc(y, m, d).getTime() - WIB_OFFSET_MINUTES * 60_000);
}

/** Shift a UTC instant to WIB wall-clock and format as "YYYY-MM-DD HH:MM:SS". */
export function toWibString(utcDate: Date): string {
  const shifted = new Date(utcDate.getTime() + WIB_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 19).replace("T", " ");
}

/** "YYYY-MM-DD" of the WIB calendar day. */
export function toWibDate(utcDate: Date): string {
  return toWibString(utcDate).slice(0, 10);
}

/**
 * Monday of the ISO week containing the WIB calendar day, as "YYYY-MM-DD".
 * Used to bucket weekly spend. Weeks start Monday because that is how the ops
 * team does their weekly recap.
 */
export function toWibWeekStart(utcDate: Date): string {
  const shifted = new Date(utcDate.getTime() + WIB_OFFSET_MINUTES * 60_000);
  const dow = (shifted.getUTCDay() + 6) % 7; // Monday = 0
  shifted.setUTCDate(shifted.getUTCDate() - dow);
  return shifted.toISOString().slice(0, 10);
}
