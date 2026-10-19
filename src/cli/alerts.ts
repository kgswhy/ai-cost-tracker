import { config } from "../config";
import { openDatabase } from "../db/index";
import { formatAlertMessage, resetAlerts } from "../alerts/index";
import { configuredWebhook, runConfiguredAlerts } from "../alerts/run";
import { detectProvider, maskWebhookUrl, PROVIDER_LABEL } from "../alerts/webhook";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const db = openDatabase(config.databasePath);

if (args.includes("--reset")) {
  console.log(`Cleared ${resetAlerts(db)} recorded alert(s); they will be sent again on the next run.`);
}

const hook = configuredWebhook(db);
const target = hook
  ? `${PROVIDER_LABEL[detectProvider(hook.url)]} ${maskWebhookUrl(hook.url)} (${hook.origin === "web" ? "set in the app" : "from .env"})`
  : "console (no webhook set in the app or in ALERT_WEBHOOK_URL)";
console.log(`Thresholds: ${config.alerts.thresholds.join("%, ")}% · delivery: ${target}${dryRun ? " · DRY RUN" : ""}`);

const result = await runConfiguredAlerts(db, { dryRun });
if (result.sent.length === 0 && result.failed.length === 0) console.log("Nothing new to alert.");
const verb = result.delivered ? (dryRun ? "would send" : "sent") : (dryRun ? "would record, no webhook set" : "recorded, no webhook set");
for (const a of result.sent) console.log(`${verb}: ${formatAlertMessage(a).replace(/\n/g, " | ")}`);
for (const f of result.failed) console.log(`FAILED ${f.alert.projectCode} @${f.alert.thresholdPct}%: ${f.error}`);
process.exitCode = result.failed.length ? 1 : 0;
