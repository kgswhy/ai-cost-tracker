import fs from "node:fs";
import type { Project } from "../types";

export interface ProjectResolver {
  resolve(label: string | null | undefined): string | null;
  projects: Project[];
}

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Builds the label -> project code lookup from projects.csv plus the alias
 * file. Project codes and names from projects.csv always match themselves; the
 * alias file adds the nicknames people actually type.
 */
export function createProjectResolver(
  projects: Project[],
  aliases: Record<string, string[]>,
  userAliases: { label: string; projectCode: string }[] = [],
): ProjectResolver {
  const lookup = new Map<string, string>();
  const codes = new Set(projects.map((p) => p.code));

  for (const p of projects) {
    lookup.set(normalizeLabel(p.code), p.code);
    lookup.set(normalizeLabel(p.name), p.code);
  }
  for (const [code, labels] of Object.entries(aliases)) {
    if (code.startsWith("_")) continue;
    if (!codes.has(code)) throw new Error(`Alias file references unknown project code ${code}`);
    for (const label of labels) {
      const key = normalizeLabel(label);
      const existing = lookup.get(key);
      if (existing && existing !== code) {
        throw new Error(`Alias "${label}" is claimed by both ${existing} and ${code}`);
      }
      lookup.set(key, code);
    }
  }

  // Aliases added from the dashboard override the config file.
  for (const a of userAliases) {
    if (!codes.has(a.projectCode)) throw new Error(`Alias "${a.label}" points at unknown project ${a.projectCode}`);
    lookup.set(normalizeLabel(a.label), a.projectCode);
  }

  return {
    projects,
    resolve(label) {
      if (!label) return null;
      return lookup.get(normalizeLabel(label)) ?? null;
    },
  };
}

export function loadProjectsCsv(path: string): Project[] {
  const text = fs.readFileSync(path, "utf8");
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const cols = header.split(",");
  const idx = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`projects.csv is missing column ${name}`);
    return i;
  };
  const iCode = idx("project_code"), iName = idx("project_name"), iClient = idx("client"), iBudget = idx("budget_idr");
  return rows
    .filter((r) => r.trim() !== "")
    .map((r) => {
      const c = r.split(",");
      return { code: c[iCode].trim(), name: c[iName].trim(), client: c[iClient].trim(), budgetIdr: Number(c[iBudget]) };
    });
}

export function loadAliases(path: string): Record<string, string[]> {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
