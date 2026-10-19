import { config } from "../config";
import type { Db } from "../db/index";
import { resolveWebhook } from "../db/settings";
import { consoleSender, runBudgetAlerts, webhookSender, type AlertRunResult } from "./index";

/** The webhook to use right now: the one set in the app, else ALERT_WEBHOOK_URL. */
export const configuredWebhook = (db: Db) => resolveWebhook(db, config.alerts.webhookUrl);

/** Alerts wired to the configured webhook, or logged to the console when there is none. */
export function runConfiguredAlerts(db: Db, opts: { dryRun?: boolean; log?: (m: string) => void } = {}): Promise<AlertRunResult> {
  const url = configuredWebhook(db)?.url ?? "";
  return runBudgetAlerts(db, {
    thresholds: config.alerts.thresholds,
    sender: url ? webhookSender(url) : consoleSender(opts.log ?? (() => {})),
    webhookConfigured: Boolean(url),
    dryRun: opts.dryRun,
  });
}
