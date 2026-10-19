import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/normalize/csv";

describe("csv parser", () => {
  it("keeps quoted commas together and trims cells", () => {
    const rows = parseCsv('line_id,usd_amount\r\nA1,"$1,036.15"\r\nA2, 13.21 \n');
    expect(rows).toEqual([{ line_id: "A1", usd_amount: "$1,036.15" }, { line_id: "A2", usd_amount: "13.21" }]);
  });
  it("preserves empty trailing fields", () => {
    const rows = parseCsv("id,ref\nT1,\n");
    expect(rows[0]).toEqual({ id: "T1", ref: "" });
  });
});
