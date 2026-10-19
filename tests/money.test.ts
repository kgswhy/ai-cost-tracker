import { describe, expect, it } from "vitest";
import { creditsToIdr, formatIdr, parseIdrAmount, parseUsdAmount, usdCentsToIdr, usdToIdr } from "../src/normalize/money.js";

const rates = { credit_to_idr: 160, usd_to_idr: 16250 };

describe("Vendor B USD amounts", () => {
  it("accepts bare, dollar-prefixed and thousands-separated values", () => {
    expect(parseUsdAmount("13.21")).toBe(13.21);
    expect(parseUsdAmount("$70.9")).toBe(70.9);
    expect(parseUsdAmount("$1,036.15")).toBe(1036.15);
    expect(parseUsdAmount(" $38.49 ")).toBe(38.49);
  });
  it("rejects values it cannot read", () => {
    expect(() => parseUsdAmount("Rp 1.000")).toThrow();
    expect(() => parseUsdAmount("")).toThrow();
  });
});

describe("manual sheet IDR amounts", () => {
  it("treats dots as thousands separators and strips Rp", () => {
    expect(parseIdrAmount("Rp 1.850.000")).toBe(1_850_000);
    expect(parseIdrAmount("47.040")).toBe(47_040);
    expect(parseIdrAmount("1.000.000")).toBe(1_000_000);
    expect(parseIdrAmount(350000)).toBe(350_000);
    expect(parseIdrAmount("Rp. 500.000")).toBe(500_000);
  });
  it("rejects non-numeric text", () => {
    expect(() => parseIdrAmount("n/a")).toThrow();
  });
});

describe("conversion to IDR with fixed rates", () => {
  it("converts credits, USD and USD cents", () => {
    expect(creditsToIdr(2001, rates)).toBe(320_160);
    expect(creditsToIdr(-1567, rates)).toBe(-250_720);
    expect(usdToIdr(13.21, rates)).toBe(214_663); // 214662.5 rounds half up
    expect(usdCentsToIdr(3455, rates)).toBe(561_438);
  });
  it("formats with Indonesian grouping", () => {
    expect(formatIdr(1850000)).toBe("Rp 1.850.000");
  });
});
