import { config } from "../config";
import type { Db } from "../db/index";
import { consoleSender, runBudgetAlerts, webhookSender, type AlertRunResult } from "./index";

/** Alerts wired to the environment: webhook if configured, console otherwise. */
export function runConfiguredAlerts(db: Db, opts: { dryRun?: boolean; log?: (m: string) => void } = {}): Promise<AlertRunResult> {
  const url = config.alerts.webhookUrl;
  return runBudgetAlerts(db, {
    thresholds: config.alerts.thresholds,
    sender: url ? webhookSender(url) : consoleSender(opts.log ?? (() => {})),
    webhookConfigured: Boolean(url),
    dryRun: opts.dryRun,
  });
}
