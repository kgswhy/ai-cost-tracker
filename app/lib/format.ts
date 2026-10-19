const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Full rupiah with Indonesian grouping: 18.971.529. Tables use this; the column header says IDR. */
export const num = (n: number) => Math.round(n).toLocaleString("id-ID");
export const idr = (n: number) => "Rp " + num(n);
export const signedIdr = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "") + idr(Math.abs(n));
export const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
export const pctRound = (n: number) => `${Math.round(n)}%`;

/** Compact rupiah for sentences: "Rp 5,8 jt". */
export function idrShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const f = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${sign}Rp ${f(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}Rp ${f(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}Rp ${f(abs / 1e3)} rb`;
  return `${sign}Rp ${abs}`;
}

/** Millions with one decimal for chart labels: "46,7". */
export const jt = (n: number) => (n / 1e6).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "12 Okt" from "2026-10-12" or a WIB timestamp "2026-10-12 08:00:00". */
export function dayId(ymd: string): string {
  const [, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_ID[m - 1]}`;
}

/** An ISO instant shown as WIB: "19 Okt, 13.08 WIB". */
export function wib(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString();
  return `${dayId(d)}, ${d.slice(11, 13)}.${d.slice(14, 16)} WIB`;
}

/** Today's date in WIB as "YYYY-MM-DD". */
export function todayWib(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export const SOURCE_LABEL: Record<string, string> = {
  vendor_a: "Vendor A",
  vendor_b: "Vendor B",
  vendor_c: "Vendor C API",
  manual_ops: "Spreadsheet manual",
};

export type Status = { cls: "ok" | "warn" | "over"; label: string };
export function statusOf(pctUsed: number, thresholds: number[]): Status {
  const warn = thresholds.find((t) => t < 100) ?? 80;
  if (pctUsed >= 100) return { cls: "over", label: "Lewat budget" };
  if (pctUsed >= warn) return { cls: "warn", label: "Mendekati batas" };
  return { cls: "ok", label: "Aman" };
}

export type PaceLike = { weeklyIdr: number | null; weeksLeft: number | null; runsOutWeek: string | null; remainingIdr: number };

/**
 * One phrase for "if spending continues like the last four weeks". The
 * projection starts from the newest data, which can be older than today, so a
 * run-out date that has already passed is said as "probably already ran out".
 */
export function paceText(p: PaceLike, today = todayWib()): string {
  if (p.remainingIdr <= 0) return `Sudah lewat ${idr(-p.remainingIdr)}`;
  if (p.weeklyIdr === null) return "Belum ada riwayat";
  if (p.weeklyIdr <= 0 || p.weeksLeft === null || !p.runsOutWeek) return "Tidak ada spend 4 minggu terakhir";
  if (p.weeksLeft > 52) return "Lebih dari setahun lagi";
  return p.runsOutWeek < today ? `Kemungkinan sudah habis sekitar ${dayId(p.runsOutWeek)}` : `Habis sekitar ${dayId(p.runsOutWeek)}`;
}

export const STATUS_TEXT: Record<Status["cls"], string> = { ok: "text-ink", warn: "text-warn", over: "text-over" };
export const STATUS_FILL: Record<Status["cls"], string> = { ok: "bg-accent", warn: "bg-warn", over: "bg-over" };
