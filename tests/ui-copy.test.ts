import { describe, expect, it } from "vitest";
import { formatAlertMessage } from "../src/alerts/index";
import { listReviewedLabels, markLabelReviewed, openDatabase } from "../src/db/index";
import { dayId, paceText, statusOf } from "../app/lib/format";

describe("budget alert message", () => {
  it("states the project, current spend, budget and percentage used, as the brief asks", () => {
    const msg = formatAlertMessage({
      projectCode: "KMD-02", projectName: "Kopi Malam Mini Drama S1", client: "Kopi Malam",
      thresholdPct: 80, spendIdr: 48_151_626, budgetIdr: 56_000_000, pctUsed: 85.985,
    });
    expect(msg.split("\n")).toEqual([
      "Peringatan budget (80%): KMD-02 Kopi Malam Mini Drama S1 (Kopi Malam)",
      "Spend saat ini: Rp 48.151.626",
      "Budget: Rp 56.000.000",
      "Budget terpakai: 86,0%",
    ]);
  });
  it("says over budget at the 100% threshold", () => {
    const msg = formatAlertMessage({
      projectCode: "GBX-01", projectName: "Greenbox", client: "Greenbox Garden",
      thresholdPct: 100, spendIdr: 18_971_529, budgetIdr: 17_000_000, pctUsed: 111.597,
    });
    expect(msg.startsWith("Lewat budget (100%): GBX-01")).toBe(true);
    expect(msg).toContain("Budget terpakai: 111,6%");
  });
});

describe("names marked as not a project", () => {
  it("are stored once and listed", () => {
    const db = openDatabase(":memory:");
    markLabelReviewed(db, "test");
    markLabelReviewed(db, "test");
    expect(listReviewedLabels(db).map((r) => r.label)).toEqual(["test"]);
  });
});

describe("dashboard wording", () => {
  const base = { weeklyIdr: 2_000_000, weeksLeft: 1.2, remainingIdr: 2_400_000 };
  it("says a run-out date that already passed as 'probably already ran out'", () => {
    expect(paceText({ ...base, runsOutWeek: "2026-10-12" }, "2026-10-19")).toBe("Kemungkinan sudah habis sekitar 12 Okt");
    expect(paceText({ ...base, runsOutWeek: "2026-10-26" }, "2026-10-19")).toBe("Habis sekitar 26 Okt");
  });
  it("covers over budget, no history and no recent spend", () => {
    expect(paceText({ weeklyIdr: 1, weeksLeft: 0, runsOutWeek: "2026-10-05", remainingIdr: -1_971_529 })).toBe("Sudah lewat Rp 1.971.529");
    expect(paceText({ weeklyIdr: null, weeksLeft: null, runsOutWeek: null, remainingIdr: 5 })).toBe("Belum ada riwayat");
    expect(paceText({ weeklyIdr: 0, weeksLeft: null, runsOutWeek: null, remainingIdr: 5 })).toBe("Tidak ada spend 4 minggu terakhir");
  });
  it("uses Indonesian month names and plain status words", () => {
    expect(dayId("2026-08-31")).toBe("31 Agu");
    expect(dayId("2026-12-14 10:00:00")).toBe("14 Des");
    expect(statusOf(111.6, [80, 100]).label).toBe("Lewat budget");
    expect(statusOf(86, [80, 100]).label).toBe("Mendekati batas");
    expect(statusOf(55, [80, 100]).label).toBe("Aman");
  });
});
