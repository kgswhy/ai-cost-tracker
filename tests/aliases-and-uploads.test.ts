import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addUserAlias, listUserAliases, openDatabase, relinkRecords, upsertProjects, upsertUsageRecords } from "../src/db/index";
import { createProjectResolver } from "../src/normalize/project";
import type { UsageRecord } from "../src/types";

const projects = [
  { code: "KMD-02", name: "Kopi Malam", client: "Kopi Malam", budgetIdr: 1_000_000 },
  { code: "INT-00", name: "Internal R&D", client: "Internal", budgetIdr: 1_000_000 },
];
const rec = (over: Partial<UsageRecord>): UsageRecord => ({
  source: "vendor_a", externalId: "T", vendor: "Vendor A", item: "image", projectLabel: "sandbox", projectCode: null,
  occurredAtUtc: new Date("2026-09-01T00:00:00Z"), originalAmount: 1, originalCurrency: "CREDIT", amountIdr: 160, ...over,
});

describe("aliases added from the dashboard", () => {
  it("relink moves existing records without a re-import, and the alias wins over the config file", () => {
    const db = openDatabase(":memory:");
    upsertProjects(db, projects);
    upsertUsageRecords(db, [
      rec({ externalId: "1", projectLabel: "sandbox" }),
      rec({ externalId: "2", projectLabel: "  SANDBOX " }),
      rec({ externalId: "3", projectLabel: "kopi malam", projectCode: "KMD-02" }),
    ]);
    addUserAlias(db, "sandbox", "INT-00");
    addUserAlias(db, "kopi malam", "INT-00"); // overrides the config alias on purpose
    const resolver = createProjectResolver(projects, { "KMD-02": ["kopi malam"] }, listUserAliases(db));
    expect(relinkRecords(db, resolver)).toBe(3);
    const codes = db.prepare(`SELECT external_id AS id, project_code AS code FROM usage_records ORDER BY id`).all();
    expect(codes).toEqual([{ id: "1", code: "INT-00" }, { id: "2", code: "INT-00" }, { id: "3", code: "INT-00" }]);
    expect(relinkRecords(db, resolver)).toBe(0);
  });

  it("refuses an alias to a project that does not exist", () => {
    expect(() => createProjectResolver(projects, {}, [{ label: "x", projectCode: "NOPE-1" }])).toThrow(/unknown project/);
  });
});

describe("uploaded source files", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "cost-tracker-up-"));
    fs.mkdirSync(path.join(root, "data"));
    fs.writeFileSync(path.join(root, "data", "vendor_a.csv"), "bundled");
    vi.spyOn(process, "cwd").mockReturnValue(root);
    vi.resetModules();
  });
  afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

  it("prefers the latest upload, validates the extension, and can fall back to the bundled file", async () => {
    const files = await import("../src/importers/files");
    expect(files.resolveSourceFile("vendor_a")).toMatchObject({ origin: "bundled", fileName: "vendor_a.csv" });
    expect(() => files.saveUpload("vendor_a", "export.xlsx", Buffer.from("x"))).toThrow(/must be .csv/);
    expect(() => files.saveUpload("vendor_a", "export.csv", Buffer.alloc(0))).toThrow(/empty/);
    const saved = files.saveUpload("vendor_a", "week-41.csv", Buffer.from("uploaded"));
    expect(saved).toMatchObject({ origin: "uploaded", fileName: "week-41.csv" });
    expect(fs.readFileSync(saved.path, "utf8")).toBe("uploaded");
    files.discardUpload("vendor_a");
    expect(files.resolveSourceFile("vendor_a").origin).toBe("bundled");
  });
});
