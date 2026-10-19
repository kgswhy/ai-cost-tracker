export const idr = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
export const pct = (n: number) => `${n.toFixed(1)}%`;
export const signedIdr = (n: number) => (n > 0 ? "+" : n < 0 ? "-" : "") + idr(Math.abs(n));

export function wib(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return d.toISOString().slice(0, 16).replace("T", " ") + " WIB";
}

export function weekLabel(monday: string): string {
  const d = new Date(monday + "T00:00:00Z");
  return "Week of " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const SOURCE_LABEL: Record<string, string> = {
  vendor_a: "Vendor A CSV",
  vendor_b: "Vendor B CSV",
  vendor_c: "Vendor C API",
  manual_ops: "Manual ops sheet",
};

// One fixed colour per project everywhere on the site, so a hue always means the same project.
export const PROJECT_COLOURS = ["#1d4ed8", "#0f766e", "#b45309", "#6d28d9", "#be123c", "#4d7c0f"];
export const UNASSIGNED_COLOUR = "#a8a29e";

export type Status = { cls: "ok" | "warn" | "over"; label: string };
export function statusOf(pctUsed: number, thresholds: number[]): Status {
  const warn = thresholds.find((t) => t < 100) ?? 80;
  if (pctUsed >= 100) return { cls: "over", label: "Over budget" };
  if (pctUsed >= warn) return { cls: "warn", label: `Warning, above ${warn}%` };
  return { cls: "ok", label: "On track" };
}

export type PaceLike = { weeklyIdr: number | null; weeksLeft: number | null; runsOutWeek: string | null; remainingIdr: number };

/** One short phrase for the "at this pace" column. */
export function paceText(p: PaceLike): string {
  if (p.remainingIdr <= 0) return `Over by ${idr(-p.remainingIdr)}`;
  if (p.weeklyIdr === null) return "No history yet";
  if (p.weeklyIdr <= 0 || p.weeksLeft === null) return "No spend in the last 4 weeks";
  const weeks = p.weeksLeft;
  const when = p.runsOutWeek ? weekLabel(p.runsOutWeek).replace("Week of ", "") : "";
  if (weeks > 52) return "More than a year left";
  return `Runs out in about ${weeks < 1 ? "a week" : `${Math.round(weeks)} weeks`}${when ? ` (${when})` : ""}`;
}

/** Compact rupiah for sentences and summaries: "Rp 165,8 jt", "Rp 2,4 M". Tables keep the full number. */
export function idrShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number) => v.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${sign}Rp ${fmt(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}Rp ${fmt(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}Rp ${fmt(abs / 1e3)} rb`;
  return `${sign}Rp ${abs}`;
}

/** "11 Oct" from a WIB timestamp "2026-10-11 21:33:00". */
export function wibDay(wibTs: string): string {
  const d = new Date(wibTs.slice(0, 10) + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Whole days between a WIB timestamp and now (in WIB). */
export function daysSinceWib(wibTs: string, now = new Date()): number {
  const then = new Date(wibTs.slice(0, 10) + "T00:00:00Z").getTime();
  const todayWib = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  const today = new Date(todayWib + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((today - then) / 86_400_000));
}
