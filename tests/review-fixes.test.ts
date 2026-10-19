import { describe, expect, it } from "vitest";
import { runBudgetAlerts, type AlertSender, type BudgetAlert } from "../src/alerts/index";
import { recordsToCsv } from "../src/analysis/exportCsv";
import { pickRoot } from "../src/config";
import { openDatabase, upsertProjects, upsertUsageRecords } from "../src/db/index";
import type { ExportRow } from "../src/db/queries";
import { isFileSource } from "../src/importers/files";
import { runImport } from "../src/importers/index";
import type { Importer } from "../src/importers/types";
import type { UsageRecord } from "../src/types";

const projects = [
  { code: "GBX-01", name: "Greenbox", client: "Greenbox", budgetIdr: 1_000_000 },
  { code: "SNJ-04", name: "Senja", client: "Senja", budgetIdr: 1_000_000 },
];
const rec = (over: Partial<UsageRecord>): UsageRecord => ({
  source: "manual_ops", externalId: "r1", vendor: "Stock Music", item: "license", projectLabel: "GBX-01", projectCode: "GBX-01",
  occurredAtUtc: new Date("2026-09-01T00:00:00Z"), originalAmount: 1, originalCurrency: "IDR", amountIdr: 450_000, ...over,
});

describe("manual sheet snapshot guard", () => {
  it("refuses to wipe stored rows when the new sheet yields nothing", async () => {
    const db = openDatabase(":memory:");
    let rows = [rec({ externalId: "r1" }), rec({ externalId: "r2" })];
    const sheet: Importer = { source: "manual_ops", label: "Spreadsheet manual", fullSnapshot: true, run: async () => ({ records: rows, fetched: rows.length, skipped: 0 }) };
    await runImport({ db, importers: [sheet] });
    rows = [];
    const [summary] = await runImport({ db, importers: [sheet] });
    expect(summary.status).toBe("failed");
    expect(summary.error).toMatch(/tidak berisi satu pun baris/);
    expect((db.prepare(`SELECT COUNT(*) AS n FROM usage_records`).get() as { n: number }).n).toBe(2);
  });
  it("still prunes rows that were really removed from the sheet", async () => {
    const db = openDatabase(":memory:");
    let rows = [rec({ externalId: "r1" }), rec({ externalId: "r2" })];
    const sheet: Importer = { source: "manual_ops", label: "Spreadsheet manual", fullSnapshot: true, run: async () => ({ records: rows, fetched: rows.length, skipped: 0 }) };
    await runImport({ db, importers: [sheet] });
    rows = [rows[0]];
    const [summary] = await runImport({ db, importers: [sheet] });
    expect(summary).toMatchObject({ status: "ok", removed: 1 });
  });
});

describe("alerts sent once even when two runs overlap", () => {
  function setup() {
    const db = openDatabase(":memory:");
    upsertProjects(db, projects);
    upsertUsageRecords(db, [rec({ externalId: "a", projectCode: "GBX-01", amountIdr: 1_200_000 }), rec({ externalId: "b", projectCode: "SNJ-04", amountIdr: 850_000 })]);
    return db;
  }
  it("two simultaneous checks deliver each project's alert exactly once", async () => {
    const db = setup();
    const sent: string[] = [];
    // A slow chat tool: both runs read the same pending list before either has finished sending.
    const slow: AlertSender = { async send(a: BudgetAlert) { await new Promise((r) => setTimeout(r, 20)); sent.push(`${a.projectCode}@${a.thresholdPct}`); return "slack"; } };
    await Promise.all([
      runBudgetAlerts(db, { thresholds: [80, 100], sender: slow, webhookConfigured: true }),
      runBudgetAlerts(db, { thresholds: [80, 100], sender: slow, webhookConfigured: true }),
    ]);
    expect(sent.sort()).toEqual(["GBX-01@100", "SNJ-04@80"]);
    const rows = db.prepare(`SELECT project_code AS p, threshold_pct AS t, delivery AS d FROM budget_alerts ORDER BY 1, 2`).all();
    expect(rows).toEqual([{ p: "GBX-01", t: 80, d: "slack" }, { p: "GBX-01", t: 100, d: "slack" }, { p: "SNJ-04", t: 80, d: "slack" }]);
  });
  it("a failed send releases its claim so the next run retries", async () => {
    const db = setup();
    const failing: AlertSender = { async send() { throw new Error("down"); } };
    await runBudgetAlerts(db, { thresholds: [80, 100], sender: failing, webhookConfigured: true });
    expect((db.prepare(`SELECT COUNT(*) AS n FROM budget_alerts`).get() as { n: number }).n).toBe(0);
    const sent: string[] = [];
    const ok: AlertSender = { async send(a) { sent.push(a.projectCode); return "slack"; } };
    await runBudgetAlerts(db, { thresholds: [80, 100], sender: ok, webhookConfigured: true });
    expect(sent.sort()).toEqual(["GBX-01", "SNJ-04"]);
  });
});

describe("csv export", () => {
  const row = (projectLabel: string, item: string, amountIdr: number): ExportRow => ({
    id: 1, source: "vendor_a", externalId: "T1", vendor: "Vendor A", item, projectLabel, projectCode: null,
    occurredAtUtc: "2026-09-01T00:00:00.000Z", occurredAtWib: "2026-09-01 07:00:00", weekStartWib: "2026-08-31",
    originalAmount: -10, originalCurrency: "CREDIT", amountIdr, refundOf: null,
  });
  it("neutralises text that a spreadsheet would run as a formula, and leaves numbers alone", () => {
    const [, line] = recordsToCsv([row('=HYPERLINK("http://evil","klik")', "@SUM(A1)", -1600)]).split("\r\n");
    expect(line).toContain(`"'=HYPERLINK(""http://evil"",""klik"")"`);
    expect(line).toContain("'@SUM(A1)");
    expect(line).toContain(",-10,CREDIT,-1600,");
  });
  it("leaves ordinary names untouched", () => {
    const [, line] = recordsToCsv([row("kmd02", "image (px-image-3)", 1600)]).split("\r\n");
    expect(line.startsWith(",kmd02,vendor_a,Vendor A,image (px-image-3),")).toBe(true);
  });
});

describe("upload sources", () => {
  it("accepts only the three real sources, not inherited object keys", () => {
    expect(isFileSource("vendor_a")).toBe(true);
    expect(isFileSource("manual_ops")).toBe(true);
    for (const bad of ["vendor_c", "toString", "constructor", "__proto__", "", 1, null]) expect(isFileSource(bad)).toBe(false);
  });
});

describe("project root", () => {
  it("prefers the first candidate that holds data/projects.csv", () => {
    const has = (p: string) => p === "/repo/data/projects.csv";
    expect(pickRoot([undefined, "/repo", "/elsewhere"], has)).toBe("/repo");
    expect(pickRoot(["/override", "/repo"], (p) => p.startsWith("/override"))).toBe("/override");
    expect(pickRoot(["/a", "/b"], () => false)).toBe("/b");
  });
});
