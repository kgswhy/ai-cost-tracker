import { runImport } from "../importers/index.js";
import { config } from "../config.js";

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

console.log(`Importing into ${config.databasePath}${only.length ? ` (only: ${only.join(", ")})` : ""}`);
const summaries = await runImport({ only: only.length ? only : undefined });

for (const s of summaries) {
  if (s.status === "failed") {
    console.log(`\n✗ ${s.label}: FAILED - ${s.error}`);
  } else {
    console.log(`\n✓ ${s.label}: fetched ${s.fetched}, inserted ${s.inserted}, updated ${s.updated}, unchanged ${s.unchanged}, skipped ${s.skipped}` +
      (s.unassigned ? `, ${s.unassigned} not linked to a project` : ""));
  }
  if (s.warnings.length) {
    const shown = verbose ? s.warnings : s.warnings.slice(0, 5);
    for (const w of shown) console.log(`    - ${w}`);
    if (!verbose && s.warnings.length > shown.length) console.log(`    - …${s.warnings.length - shown.length} more (use --verbose)`);
  }
}

const failed = summaries.filter((s) => s.status === "failed").length;
process.exitCode = failed > 0 ? 1 : 0;
