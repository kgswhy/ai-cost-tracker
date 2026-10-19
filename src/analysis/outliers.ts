export interface Priced { vendor: string; item: string; amountIdr: number }

export interface OutlierVerdict { isOutlier: boolean; medianIdr: number | null; ratio: number | null; groupSize: number }

/**
 * A charge is unusual when it is `factor` times the median of other charges
 * for the same vendor and item. Grouping by item matters: a video render is
 * legitimately ten times an image job, so vendor-wide medians would flag every
 * video. Groups smaller than `minGroup` have no usable median and never flag.
 * Refunds (negative amounts) are ignored on both sides.
 */
export function findOutliers<T extends Priced>(records: T[], factor = 8, minGroup = 5): Map<T, OutlierVerdict> {
  const groups = new Map<string, number[]>();
  const keyOf = (r: Priced) => `${r.vendor}\u0000${r.item}`;
  for (const r of records) if (r.amountIdr > 0) (groups.get(keyOf(r)) ?? groups.set(keyOf(r), []).get(keyOf(r))!).push(r.amountIdr);

  const medians = new Map<string, { median: number; size: number }>();
  for (const [k, values] of groups) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    medians.set(k, { median, size: sorted.length });
  }

  const out = new Map<T, OutlierVerdict>();
  for (const r of records) {
    const m = medians.get(keyOf(r));
    if (!m || r.amountIdr <= 0 || m.size < minGroup || m.median <= 0) {
      out.set(r, { isOutlier: false, medianIdr: m?.median ?? null, ratio: null, groupSize: m?.size ?? 0 });
      continue;
    }
    const ratio = r.amountIdr / m.median;
    out.set(r, { isOutlier: ratio >= factor, medianIdr: m.median, ratio, groupSize: m.size });
  }
  return out;
}
