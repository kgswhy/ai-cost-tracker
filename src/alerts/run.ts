import { config } from "../config.js";
import type { Db } from "../db/index.js";
import { consoleSender, runBudgetAlerts, webhookSender, type AlertRunResult } from "./index.js";

/** Alerts wired to the environment: webhook if configured, console otherwise. */
export function runConfiguredAlerts(db: Db, opts: { dryRun?: boolean } = {}): Promise<AlertRunResult> {
  const url = config.alerts.webhookUrl;
  return runBudgetAlerts(db, {
    thresholds: config.alerts.thresholds,
    sender: url ? webhookSender(url) : consoleSender(),
    webhookConfigured: Boolean(url),
    dryRun: opts.dryRun,
  });
}
