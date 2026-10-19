import { describe, expect, it } from "vitest";
import { createProjectResolver } from "../src/normalize/project.js";

const projects = [
  { code: "KMD-02", name: "Kopi Malam Mini Drama S1", client: "Kopi Malam", budgetIdr: 1 },
  { code: "INT-00", name: "Internal R&D", client: "Internal", budgetIdr: 1 },
];

describe("project label resolution", () => {
  const r = createProjectResolver(projects, { "KMD-02": ["kmd02", "kmd 02", "kopi malam", "kopi malam drama"], "INT-00": ["rnd", "r&d", "internal"] } as Record<string, string[]>);

  it("matches codes and names case-insensitively", () => {
    expect(r.resolve("KMD-02")).toBe("KMD-02");
    expect(r.resolve("kmd-02")).toBe("KMD-02");
    expect(r.resolve("Kopi Malam Mini Drama S1")).toBe("KMD-02");
  });
  it("matches aliases with odd spacing and case", () => {
    expect(r.resolve("Kopi Malam")).toBe("KMD-02");
    expect(r.resolve("  kopi   malam drama ")).toBe("KMD-02");
    expect(r.resolve("KMD 02")).toBe("KMD-02");
    expect(r.resolve("R&D")).toBe("INT-00");
    expect(r.resolve("rnd")).toBe("INT-00");
  });
  it("returns null for blank or unknown labels", () => {
    expect(r.resolve("")).toBeNull();
    expect(r.resolve(undefined)).toBeNull();
    expect(r.resolve("sandbox")).toBeNull();
    expect(r.resolve("new client pitch")).toBeNull();
  });
  it("refuses an alias file that points one label at two projects", () => {
    expect(() => createProjectResolver(projects, { "KMD-02": ["shared"], "INT-00": ["shared"] })).toThrow(/claimed by both/);
  });
  it("refuses aliases for projects that do not exist", () => {
    expect(() => createProjectResolver(projects, { "ZZZ-99": ["x"] })).toThrow(/unknown project/);
  });
});
