import { runImport } from "../importers/index";
import { config } from "../config";
import { openDatabase } from "../db/index";
import { formatAlertMessage } from "../alerts/index";
import { runConfiguredAlerts } from "../alerts/run";

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

console.log(`Importing into ${config.databasePath}${only.length ? ` (only: ${only.join(", ")})` : ""}`);
const db = openDatabase(config.databasePath);
const summaries = await runImport({ db, only: only.length ? only : undefined });

for (const s of summaries) {
  if (s.status === "failed") {
    console.log(`\n✗ ${s.label}: FAILED - ${s.error}`);
  } else {
    console.log(`\n✓ ${s.label}: fetched ${s.fetched}, inserted ${s.inserted}, updated ${s.updated}, unchanged ${s.unchanged}, skipped ${s.skipped}` +
      (s.removed ? `, removed ${s.removed}` : "") +
      (s.unassigned ? `, ${s.unassigned} not linked to a project` : ""));
  }
  if (s.warnings.length) {
    const shown = verbose ? s.warnings : s.warnings.slice(0, 5);
    for (const w of shown) console.log(`    - ${w}`);
    if (!verbose && s.warnings.length > shown.length) console.log(`    - …${s.warnings.length - shown.length} more (use --verbose)`);
  }
}

const failed = summaries.filter((s) => s.status === "failed").length;

if (!process.argv.includes("--no-alerts")) {
  const alerts = await runConfiguredAlerts(db);
  if (alerts.sent.length || alerts.failed.length) console.log("");
  for (const a of alerts.sent) console.log(`alert sent: ${formatAlertMessage(a).replace(/\n/g, " | ")}`);
  for (const f of alerts.failed) console.log(`✗ alert ${f.alert.projectCode} @${f.alert.thresholdPct}% failed: ${f.error}`);
}

process.exitCode = failed > 0 ? 1 : 0;
