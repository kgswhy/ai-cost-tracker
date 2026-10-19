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
  if (pctUsed >= warn) return { cls: "warn", label: `Above ${warn}%` };
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
