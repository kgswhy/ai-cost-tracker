import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createProjectResolver } from "../src/normalize/project";
import { vendorAImporter } from "../src/importers/vendorA";
import { vendorBImporter } from "../src/importers/vendorB";
import { manualOpsImporter } from "../src/importers/manualOps";
import { fetchAllVendorCUsage } from "../src/importers/vendorC";
import type { ImportContext } from "../src/importers/types";

const projects = [
  { code: "GBX-01", name: "Greenbox Garden Benchmark", client: "Greenbox Garden", budgetIdr: 1 },
  { code: "SNJ-04", name: "Senja Resort Teaser", client: "Senja Resort", budgetIdr: 1 },
];
function ctx(): ImportContext & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    rates: { credit_to_idr: 160, usd_to_idr: 16250 },
    projects: createProjectResolver(projects, { "GBX-01": ["greenbox"], "SNJ-04": ["snj04"] }),
    warn: (m) => warnings.push(m),
    warnings,
  };
}
const tmp = (name: string, content: string | Buffer) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cost-tracker-")), name);
  fs.writeFileSync(p, content);
  return p;
};

describe("Vendor A importer", () => {
  it("keeps refunds as negative records linked to the original charge", async () => {
    const csv = `transaction_id,timestamp_utc,project_tag,model,job_type,credits,ref_transaction_id
TXN1,09/01/2026 11:06,GBX-01,px-video-2-pro,video,1567,
TXN2,09/01/2026 13:45,GBX-01,px-video-2-pro,refund,-1567,TXN1
`;
    const out = await vendorAImporter(tmp("a.csv", csv)).run(ctx());
    expect(out.records).toHaveLength(2);
    expect(out.records[1]).toMatchObject({ externalId: "TXN2", amountIdr: -250_720, refundOf: "TXN1", projectCode: "GBX-01" });
    expect(out.records.reduce((s, r) => s + r.amountIdr, 0)).toBe(0);
  });
});

describe("Vendor B importer", () => {
  it("imports a repeated line_id once and parses messy amounts", async () => {
    const csv = `line_id,time_utc,workspace,product,usd_amount
L1,08-09-2026 15:52,Greenbox,Motion Pro render,$14.19
L1,08-09-2026 15:52,Greenbox,Motion Pro render,$14.19
L2,16-09-2026 16:13,snj04,Voice clone,"$1,036.15"
`;
    const c = ctx();
    const out = await vendorBImporter(tmp("b.csv", csv)).run(c);
    expect(out.fetched).toBe(3);
    expect(out.skipped).toBe(1);
    expect(out.records.map((r) => r.externalId)).toEqual(["L1", "L2"]);
    expect(out.records[1]).toMatchObject({ projectCode: "SNJ-04", originalAmount: 1036.15, amountIdr: 16_837_438 });
  });
});

describe("manual ops importer", () => {
  function sheet(rows: unknown[][]): string {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Rekap");
    return tmp("ops.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
  }
  it("skips title, blank, TOTAL and Vendor A rows, and dedupes repeated invoices", async () => {
    const file = sheet([
      ["Rekap Biaya Produksi AI"],
      [],
      ["Tanggal", "Project", "Tool / Vendor", "Keterangan", "Nominal", "Ref"],
      [46266, "greenbox", "Tool D", "Team seat subscription - INV-948", "Rp 1.850.000", ""],
      ["3/9/2026", "SNJ-04", "Vendor A", "Video generation", 312160, "TXN100775"],
      ["14 Sep 2026", "snj04", "Stock Music", "Music license - INV-928", "Rp 450.000", ""],
      ["2026-09-14", "SNJ-04", "Stock Music", "Music license - INV-928", 450000, ""],
      [],
      ["2026-09-15", "", "Stock Music", "Music license - INV-950", 450000, ""],
      [null, null, null, "TOTAL", 3_062_160, null],
    ]);
    const c = ctx();
    const out = await manualOpsImporter(file).run(c);
    expect(out.fetched).toBe(5);
    expect(out.skipped).toBe(2); // 1 Vendor A overlap + 1 duplicate invoice
    expect(out.records.map((r) => [r.vendor, r.amountIdr, r.projectCode])).toEqual([
      ["Tool D", 1_850_000, "GBX-01"],
      ["Stock Music", 450_000, "SNJ-04"],
      ["Stock Music", 450_000, null],
    ]);
    expect(c.warnings.join("\n")).toMatch(/INV-928/);
  });
  it("gives the same external id on every run so re-imports are idempotent", async () => {
    const file = sheet([["Tanggal", "Project", "Tool / Vendor", "Keterangan", "Nominal", "Ref"], ["2026-10-01", "greenbox", "Tool D", "Seat - INV-1", 1000, ""]]);
    const a = await manualOpsImporter(file).run(ctx());
    const b = await manualOpsImporter(file).run(ctx());
    expect(a.records[0].externalId).toBe(b.records[0].externalId);
  });
});

describe("Vendor C client", () => {
  function fakeApi(script: Array<number | "net">, pages: Record<number, unknown[]>) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      const next = script.shift();
      if (next === "net") throw new Error("ECONNRESET");
      if (next === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Retry-After": "2" } });
      if (next === 500) return new Response("{}", { status: 500 });
      if (next === 401) return new Response("{}", { status: 401 });
      const page = Number(new URL(url).searchParams.get("page"));
      const data = pages[page] ?? [];
      return new Response(JSON.stringify({ data, page, per_page: 2, total: 3, has_more: page < Object.keys(pages).length }), { status: 200 });
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }
  const sleeps: number[] = [];
  const sleep = async (ms: number) => { sleeps.push(ms); };

  it("walks every page and retries 429, 5xx and network errors", async () => {
    sleeps.length = 0;
    const api = fakeApi([429, 500, "net", 200, 200], { 1: [{ id: "a" }, { id: "b" }], 2: [{ id: "c" }] });
    const all = await fetchAllVendorCUsage({ baseUrl: "http://x", apiKey: "k", perPage: 2, fetchImpl: api.fetchImpl, sleep, baseDelayMs: 100 });
    expect(all.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(api.calls).toHaveLength(5);
    expect(sleeps).toEqual([2000, 200, 400]); // Retry-After honoured, then exponential backoff
  });
  it("fails fast on 401 rather than retrying", async () => {
    const api = fakeApi([401], {});
    await expect(fetchAllVendorCUsage({ baseUrl: "http://x", apiKey: "bad", fetchImpl: api.fetchImpl, sleep })).rejects.toThrow(/401/);
    expect(api.calls).toHaveLength(1);
  });
  it("gives up after maxAttempts", async () => {
    const api = fakeApi([500, 500, 500], {});
    await expect(fetchAllVendorCUsage({ baseUrl: "http://x", apiKey: "k", maxAttempts: 3, fetchImpl: api.fetchImpl, sleep })).rejects.toThrow(/after 3 attempts/);
  });
});

describe("wrong files fail with a message the ops team can act on", () => {
  it("names the missing Vendor A column instead of failing on the first row", async () => {
    const p = tmp("a.csv", "transaction_id,timestamp_utc,project_tag,model,job_type,jumlah_kredit\nT1,09/01/2026 03:16,greenbox,m,image,5\n");
    await expect(vendorAImporter(p).run(ctx())).rejects.toThrow(
      "File Vendor A tidak punya kolom credits. Pastikan yang diunggah adalah export Vendor A yang benar. " +
      "Kolom yang dibutuhkan: transaction_id, timestamp_utc, project_tag, model, job_type, credits.",
    );
  });
  it("refuses a Vendor A file uploaded into the Vendor B slot", async () => {
    const p = tmp("b.csv", "transaction_id,timestamp_utc,project_tag,model,job_type,credits\nT1,09/01/2026 03:16,greenbox,m,image,5\n");
    await expect(vendorBImporter(p).run(ctx())).rejects.toThrow("File Vendor B tidak punya kolom line_id, time_utc, workspace, product, usd_amount.");
  });
  it("points at the transaction when a credits value is not a number", async () => {
    const p = tmp("a.csv", "transaction_id,timestamp_utc,project_tag,model,job_type,credits\nT9,09/01/2026 03:16,greenbox,m,image,abc\n");
    await expect(vendorAImporter(p).run(ctx())).rejects.toThrow('Transaksi T9 di file Vendor A: kolom credits berisi "abc", bukan angka.');
  });
  it("explains a spreadsheet without the Tanggal header row", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Project"], ["2026-09-01", "greenbox"]]), "Sheet1");
    const p = tmp("m.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    await expect(manualOpsImporter(p).run(ctx())).rejects.toThrow("Spreadsheet manual tidak punya baris judul kolom yang diawali Tanggal");
  });
});
