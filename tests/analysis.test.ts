import { describe, expect, it } from "vitest";
import { computePace } from "../src/analysis/pace";
import { findOutliers } from "../src/analysis/outliers";

describe("pace projection", () => {
  const weeks = [
    { weekStart: "2026-09-14", spendIdr: 1_000_000 },
    { weekStart: "2026-09-21", spendIdr: 2_000_000 },
    { weekStart: "2026-09-28", spendIdr: 3_000_000 },
    { weekStart: "2026-10-05", spendIdr: 2_000_000 },
  ];
  it("averages the last four weeks and projects when the budget runs out", () => {
    const p = computePace(weeks, 20_000_000, 8_000_000, "2026-10-05");
    expect(p.weeklyIdr).toBe(2_000_000);
    expect(p.remainingIdr).toBe(12_000_000);
    expect(p.weeksLeft).toBe(6);
    expect(p.runsOutWeek).toBe("2026-11-16");
    expect(p.latestVsAverage).toBe(1);
  });
  it("counts weeks with no spend as zero inside the window", () => {
    const p = computePace([{ weekStart: "2026-10-05", spendIdr: 4_000_000 }], 10_000_000, 4_000_000, "2026-10-05");
    expect(p.weeklyIdr).toBe(1_000_000); // 4M + 0 + 0 + 0 over four weeks
    expect(p.latestVsAverage).toBe(4);
  });
  it("reports zero weeks left when already over budget", () => {
    const p = computePace(weeks, 5_000_000, 8_000_000, "2026-10-05");
    expect(p.weeksLeft).toBe(0);
    expect(p.remainingIdr).toBe(-3_000_000);
  });
  it("has no projection without history", () => {
    expect(computePace([], 1, 0, null).weeklyIdr).toBeNull();
    const idle = computePace([{ weekStart: "2026-08-03", spendIdr: 100 }], 1_000, 100, "2026-10-05");
    expect(idle.weeklyIdr).toBe(0);
    expect(idle.weeksLeft).toBeNull();
  });
});

describe("outlier detection", () => {
  const rec = (vendor: string, item: string, amountIdr: number) => ({ vendor, item, amountIdr });
  it("flags a charge far above the median of its vendor and item", () => {
    const normal = Array.from({ length: 8 }, (_, i) => rec("Vendor B", "Voice clone", 700_000 + i * 10_000));
    const big = rec("Vendor B", "Voice clone", 16_837_438);
    const v = findOutliers([...normal, big]);
    expect(v.get(big)?.isOutlier).toBe(true);
    expect(v.get(normal[0])?.isOutlier).toBe(false);
  });
  it("does not compare a video job with image jobs", () => {
    const images = Array.from({ length: 6 }, () => rec("Vendor A", "image (px-image-3)", 20_000));
    const video = rec("Vendor A", "video (px-video-2)", 350_000);
    expect(findOutliers([...images, video]).get(video)?.isOutlier).toBe(false);
  });
  it("needs a minimum group size and ignores refunds", () => {
    const few = [rec("X", "y", 1), rec("X", "y", 1), rec("X", "y", 1_000_000)];
    expect(findOutliers(few).get(few[2])?.isOutlier).toBe(false);
    const refund = rec("Vendor B", "Voice clone", -50_000_000);
    const group = Array.from({ length: 6 }, () => rec("Vendor B", "Voice clone", 100));
    expect(findOutliers([...group, refund]).get(refund)?.isOutlier).toBe(false);
  });
});

describe("csv export", () => {
  it("quotes commas and quotes, keeps nulls empty", async () => {
    const { recordsToCsv } = await import("../src/analysis/exportCsv");
    const csv = recordsToCsv([{
      id: 1, source: "vendor_b", externalId: "L1", vendor: "Vendor B", item: 'Voice clone, "pro"', projectLabel: "kmd02", projectCode: "KMD-02",
      occurredAtUtc: "2026-09-16T16:13:00.000Z", occurredAtWib: "2026-09-16 23:13:00", weekStartWib: "2026-09-14",
      originalAmount: 1036.15, originalCurrency: "USD", amountIdr: 16837438, refundOf: null,
    }]);
    const [header, row] = csv.split("\r\n");
    expect(header.startsWith("project_code,project_label,source,vendor,item,")).toBe(true);
    expect(row).toContain('"Voice clone, ""pro"""');
    expect(row.endsWith(",16837438,,L1")).toBe(true);
  });
});
