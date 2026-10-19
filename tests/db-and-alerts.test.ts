import { describe, expect, it } from "vitest";
import { openDatabase, upsertProjects, upsertUsageRecords } from "../src/db/index.js";
import { projectSpend, totals } from "../src/db/queries.js";
import { pendingAlerts, runBudgetAlerts, type AlertSender, type BudgetAlert } from "../src/alerts/index.js";
import type { UsageRecord } from "../src/types.js";

const projects = [
  { code: "GBX-01", name: "Greenbox", client: "Greenbox", budgetIdr: 1_000_000 },
  { code: "SNJ-04", name: "Senja", client: "Senja", budgetIdr: 1_000_000 },
];
function rec(over: Partial<UsageRecord>): UsageRecord {
  return {
    source: "vendor_a", externalId: "T1", vendor: "Vendor A", item: "image", projectLabel: "GBX-01", projectCode: "GBX-01",
    occurredAtUtc: new Date("2026-09-01T00:00:00Z"), originalAmount: 10, originalCurrency: "CREDIT", amountIdr: 1600, ...over,
  };
}
function freshDb() {
  const db = openDatabase(":memory:");
  upsertProjects(db, projects);
  return db;
}

describe("idempotent import", () => {
  it("re-importing the same records changes nothing", () => {
    const db = freshDb();
    const batch = [rec({ externalId: "T1", amountIdr: 500_000 }), rec({ externalId: "T2", amountIdr: 300_000 })];
    expect(upsertUsageRecords(db, batch)).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(upsertUsageRecords(db, batch)).toEqual({ inserted: 0, updated: 0, unchanged: 2 });
    expect(totals(db)).toMatchObject({ spendIdr: 800_000, recordCount: 2 });
  });
  it("a corrected record updates in place instead of duplicating", () => {
    const db = freshDb();
    upsertUsageRecords(db, [rec({ externalId: "T1", projectCode: null, projectLabel: "sandbox" })]);
    expect(upsertUsageRecords(db, [rec({ externalId: "T1", projectCode: "SNJ-04", projectLabel: "sandbox" })])).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(projectSpend(db).find((p) => p.code === "SNJ-04")?.spendIdr).toBe(1600);
    expect(totals(db).recordCount).toBe(1);
  });
  it("the same external id from different sources are different records", () => {
    const db = freshDb();
    upsertUsageRecords(db, [rec({ source: "vendor_a", externalId: "X" }), rec({ source: "vendor_b", externalId: "X" })]);
    expect(totals(db).recordCount).toBe(2);
  });
});

describe("budget alerts", () => {
  function sender(): AlertSender & { sent: BudgetAlert[] } {
    const sent: BudgetAlert[] = [];
    return { sent, async send(a) { sent.push(a); return "webhook"; } };
  }

  it("fires at 80% and not below", () => {
    const db = freshDb();
    upsertUsageRecords(db, [rec({ externalId: "a", projectCode: "GBX-01", amountIdr: 800_000 }), rec({ externalId: "b", projectCode: "SNJ-04", amountIdr: 799_999 })]);
    const pending = pendingAlerts(db, [80, 100], true);
    expect(pending.map((a) => [a.projectCode, a.thresholdPct])).toEqual([["GBX-01", 80]]);
    expect(pending[0].pctUsed).toBeCloseTo(80);
  });

  it("sends each threshold once, even across repeated runs", async () => {
    const db = freshDb();
    const s = sender();
    upsertUsageRecords(db, [rec({ externalId: "a", amountIdr: 850_000 })]);
    await runBudgetAlerts(db, { thresholds: [80, 100], sender: s, webhookConfigured: true });
    await runBudgetAlerts(db, { thresholds: [80, 100], sender: s, webhookConfigured: true });
    expect(s.sent.map((a) => a.thresholdPct)).toEqual([80]);

    upsertUsageRecords(db, [rec({ externalId: "b", amountIdr: 200_000 })]); // now 105%
    await runBudgetAlerts(db, { thresholds: [80, 100], sender: s, webhookConfigured: true });
    expect(s.sent.map((a) => a.thresholdPct)).toEqual([80, 100]);
  });

  it("sends one message for the highest threshold when several are crossed at once", async () => {
    const db = freshDb();
    const s = sender();
    upsertUsageRecords(db, [rec({ externalId: "a", amountIdr: 1_200_000 })]);
    const r = await runBudgetAlerts(db, { thresholds: [80, 100], sender: s, webhookConfigured: true });
    expect(r.sent.map((a) => a.thresholdPct)).toEqual([100]);
    expect(pendingAlerts(db, [80, 100], true)).toEqual([]);
  });

  it("re-sends through the webhook alerts that were only logged to the console", async () => {
    const db = freshDb();
    upsertUsageRecords(db, [rec({ externalId: "a", amountIdr: 900_000 })]);
    const consoleOnly: AlertSender = { async send() { return "console"; } };
    await runBudgetAlerts(db, { thresholds: [80], sender: consoleOnly, webhookConfigured: false });
    expect(pendingAlerts(db, [80], false)).toEqual([]);
    expect(pendingAlerts(db, [80], true).map((a) => a.projectCode)).toEqual(["GBX-01"]);
  });

  it("records nothing when delivery fails so it is retried next run", async () => {
    const db = freshDb();
    upsertUsageRecords(db, [rec({ externalId: "a", amountIdr: 900_000 })]);
    const failing: AlertSender = { async send() { throw new Error("webhook down"); } };
    const r = await runBudgetAlerts(db, { thresholds: [80], sender: failing, webhookConfigured: true });
    expect(r.failed).toHaveLength(1);
    expect(pendingAlerts(db, [80], true)).toHaveLength(1);
  });
});

describe("full-snapshot sources", () => {
  it("drops records that disappeared from the source on the next run", async () => {
    const { runImport } = await import("../src/importers/index.js");
    const db = openDatabase(":memory:");
    let batch = [rec({ source: "manual_ops", externalId: "row-1" }), rec({ source: "manual_ops", externalId: "row-2" })];
    const importer = { source: "manual_ops" as const, label: "sheet", fullSnapshot: true, run: async () => ({ records: batch, fetched: batch.length, skipped: 0 }) };
    await runImport({ db, importers: [importer] });
    expect(totals(db).recordCount).toBe(2);
    batch = [batch[0]];
    const [summary] = await runImport({ db, importers: [importer] });
    expect(summary).toMatchObject({ inserted: 0, unchanged: 1, removed: 1 });
    expect(totals(db).recordCount).toBe(1);
  });
});
