export interface WeekPoint { weekStart: string; spendIdr: number }

export interface Pace {
  /** Average spend per week over the window, or null when there is no spend history. */
  weeklyIdr: number | null;
  weeksInWindow: number;
  remainingIdr: number;
  /** Weeks until the budget is gone at this pace; 0 when already over; null when pace is zero. */
  weeksLeft: number | null;
  /** Monday of the week in which the budget runs out, "YYYY-MM-DD", or null. */
  runsOutWeek: string | null;
  /** Spend in the latest week compared with the window average, as a ratio (1.2 = 20% faster). */
  latestVsAverage: number | null;
}

/**
 * Straight-line projection from recent spend. `weeks` is the project's weekly
 * spend; `latestWeek` is the most recent week the whole dataset has data for,
 * so a project with no spend lately still counts those weeks as zero.
 * Deliberately simple: no seasonality, no committed costs, and the page says so.
 */
export function computePace(weeks: WeekPoint[], budgetIdr: number, spendIdr: number, latestWeek: string | null, window = 4): Pace {
  const remainingIdr = budgetIdr - spendIdr;
  if (!latestWeek || weeks.length === 0) {
    return { weeklyIdr: null, weeksInWindow: 0, remainingIdr, weeksLeft: null, runsOutWeek: null, latestVsAverage: null };
  }
  const byWeek = new Map(weeks.map((w) => [w.weekStart, w.spendIdr]));
  const windowWeeks: string[] = [];
  for (let i = 0; i < window; i++) windowWeeks.push(addDays(latestWeek, -7 * i));
  const values = windowWeeks.map((w) => byWeek.get(w) ?? 0);
  const weeklyIdr = values.reduce((s, v) => s + v, 0) / values.length;
  const latest = values[0];

  let weeksLeft: number | null = null;
  let runsOutWeek: string | null = null;
  if (remainingIdr <= 0) { weeksLeft = 0; runsOutWeek = latestWeek; }
  else if (weeklyIdr > 0) { weeksLeft = remainingIdr / weeklyIdr; runsOutWeek = addDays(latestWeek, 7 * Math.ceil(weeksLeft)); }

  return {
    weeklyIdr, weeksInWindow: values.length, remainingIdr, weeksLeft, runsOutWeek,
    latestVsAverage: weeklyIdr > 0 ? latest / weeklyIdr : null,
  };
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
