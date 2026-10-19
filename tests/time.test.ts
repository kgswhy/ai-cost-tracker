import { describe, expect, it } from "vitest";
import { parseDmyDashUtc, parseIsoUtc, parseManualDateWib, parseUsSlashUtc, toWibDate, toWibString, toWibWeekStart } from "../src/normalize/time.js";

describe("vendor timestamp formats", () => {
  it("Vendor A uses MM/DD/YYYY HH:MM in UTC", () => {
    expect(parseUsSlashUtc("09/01/2026 03:16").toISOString()).toBe("2026-09-01T03:16:00.000Z");
    expect(parseUsSlashUtc("10/11/2026 14:33").toISOString()).toBe("2026-10-11T14:33:00.000Z");
  });
  it("Vendor B uses DD-MM-YYYY HH:MM in UTC", () => {
    expect(parseDmyDashUtc("30-08-2026 17:37").toISOString()).toBe("2026-08-30T17:37:00.000Z");
    expect(parseDmyDashUtc("01-10-2026 03:21").toISOString()).toBe("2026-10-01T03:21:00.000Z");
  });
  it("Vendor C uses ISO 8601", () => {
    expect(parseIsoUtc("2026-08-31T01:18:32Z").toISOString()).toBe("2026-08-31T01:18:32.000Z");
  });
  it("rejects garbage instead of guessing", () => {
    expect(() => parseUsSlashUtc("2026-09-01")).toThrow();
    expect(() => parseDmyDashUtc("09/01/2026 03:16")).toThrow();
    expect(() => parseUsSlashUtc("13/40/2026 00:00")).toThrow();
  });
});

describe("manual spreadsheet dates (typed in WIB)", () => {
  const midnightWib = (ymd: string) => `${ymd}T00:00:00.000Z`;
  it("handles every format the ops team uses", () => {
    expect(toWibString(parseManualDateWib(46266))).toBe("2026-09-01 00:00:00"); // Excel serial
    expect(toWibString(parseManualDateWib("1/9/2026"))).toBe("2026-09-01 00:00:00"); // D/M/YYYY, not Jan 9
    expect(toWibString(parseManualDateWib("2026-09-04"))).toBe("2026-09-04 00:00:00");
    expect(toWibString(parseManualDateWib("14 Sep 2026"))).toBe("2026-09-14 00:00:00");
    expect(toWibString(parseManualDateWib("01 Okt 2026"))).toBe("2026-10-01 00:00:00"); // Indonesian month
    expect(toWibString(parseManualDateWib("30/9/2026"))).toBe("2026-09-30 00:00:00");
  });
  it("stores midnight WIB as 17:00 UTC the previous day", () => {
    expect(parseManualDateWib("2026-09-01").toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(parseManualDateWib("2026-09-01").toISOString()).not.toBe(midnightWib("2026-09-01"));
  });
  it("rejects unknown month names", () => {
    expect(() => parseManualDateWib("01 Foo 2026")).toThrow(/month/i);
  });
});

describe("WIB conversion", () => {
  it("shifts by +7h and crosses the date line", () => {
    const d = new Date("2026-09-06T21:49:00Z");
    expect(toWibString(d)).toBe("2026-09-07 04:49:00");
    expect(toWibDate(d)).toBe("2026-09-07");
  });
  it("buckets weeks on Monday in WIB, not UTC", () => {
    // Sunday 2026-09-06 23:00 UTC is Monday 2026-09-07 06:00 WIB -> belongs to the week of 7 Sep
    expect(toWibWeekStart(new Date("2026-09-06T23:00:00Z"))).toBe("2026-09-07");
    // Sunday 2026-09-06 10:00 UTC is still Sunday in WIB -> week of 31 Aug
    expect(toWibWeekStart(new Date("2026-09-06T10:00:00Z"))).toBe("2026-08-31");
    expect(toWibWeekStart(new Date("2026-09-07T00:00:00Z"))).toBe("2026-09-07");
  });
});
