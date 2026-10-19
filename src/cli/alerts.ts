import { config } from "../config.js";
import { openDatabase } from "../db/index.js";
import { formatAlertMessage, resetAlerts } from "../alerts/index.js";
import { runConfiguredAlerts } from "../alerts/run.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const db = openDatabase(config.databasePath);

if (args.includes("--reset")) {
  console.log(`Cleared ${resetAlerts(db)} recorded alert(s); they will be sent again on the next run.`);
}

const target = config.alerts.webhookUrl ? `webhook ${config.alerts.webhookUrl}` : "console (ALERT_WEBHOOK_URL not set)";
console.log(`Thresholds: ${config.alerts.thresholds.join("%, ")}% · delivery: ${target}${dryRun ? " · DRY RUN" : ""}`);

const result = await runConfiguredAlerts(db, { dryRun });
if (result.sent.length === 0 && result.failed.length === 0) console.log("Nothing new to alert.");
for (const a of result.sent) console.log(`${dryRun ? "would send" : "sent"}: ${formatAlertMessage(a).replace(/\n/g, " | ")}`);
for (const f of result.failed) console.log(`FAILED ${f.alert.projectCode} @${f.alert.thresholdPct}%: ${f.error}`);
process.exitCode = result.failed.length ? 1 : 0;
