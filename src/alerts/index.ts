import type { Db } from "../db/index";
import { projectSpend, type ProjectSpend } from "../db/queries";
import { formatIdr } from "../normalize/money";
import { buildPayload, detectProvider, postWebhook } from "./webhook";

export interface BudgetAlert {
  projectCode: string;
  projectName: string;
  client: string;
  thresholdPct: number;
  spendIdr: number;
  budgetIdr: number;
  pctUsed: number;
}

export interface AlertSender {
  /** Returns the delivery channel used: "slack", "discord", "webhook" or "console". */
  send(alert: BudgetAlert): Promise<string>;
}

/**
 * Which (project, threshold) pairs have been crossed but not yet announced.
 * A pair is announced once; crossing 80% and later 100% produces two alerts.
 * If an alert was previously only logged to the console (no webhook
 * configured at the time), it is sent again once a webhook exists.
 */
export function pendingAlerts(db: Db, thresholds: number[], webhookConfigured: boolean): BudgetAlert[] {
  const delivered = new Set(
    (db.prepare(`SELECT project_code AS code, threshold_pct AS t, delivery FROM budget_alerts`).all() as { code: string; t: number; delivery: string }[])
      .filter((r) => !webhookConfigured || r.delivery !== "console")
      .map((r) => `${r.code}|${r.t}`),
  );
  const out: BudgetAlert[] = [];
  for (const p of projectSpend(db)) {
    for (const t of thresholds) {
      if (p.budgetIdr <= 0 || p.pctUsed < t) continue;
      if (delivered.has(`${p.code}|${t}`)) continue;
      out.push(toAlert(p, t));
    }
  }
  return out;
}

function toAlert(p: ProjectSpend, thresholdPct: number): BudgetAlert {
  return {
    projectCode: p.code, projectName: p.name, client: p.client, thresholdPct,
    spendIdr: p.spendIdr, budgetIdr: p.budgetIdr, pctUsed: p.pctUsed,
  };
}

/** The message the webhook receives: project, current spend, budget and percentage used, in the ops team's language. */
export function formatAlertMessage(a: BudgetAlert): string {
  const head = a.thresholdPct >= 100 ? `Lewat budget (${a.thresholdPct}%)` : `Peringatan budget (${a.thresholdPct}%)`;
  return [
    `${head}: ${a.projectCode} ${a.projectName} (${a.client})`,
    `Spend saat ini: ${formatIdr(a.spendIdr)}`,
    `Budget: ${formatIdr(a.budgetIdr)}`,
    `Budget terpakai: ${a.pctUsed.toFixed(1).replace(".", ",")}%`,
  ].join("\n");
}

/** Posts each alert in the format of the tool the URL belongs to (Slack, Discord, or a generic JSON body). */
export function webhookSender(url: string, fetchImpl: typeof fetch = fetch): AlertSender {
  const provider = detectProvider(url);
  return {
    async send(alert) {
      await postWebhook(url, buildPayload(provider, formatAlertMessage(alert), alert), fetchImpl);
      return provider === "generic" ? "webhook" : provider;
    },
  };
}

export function consoleSender(log: (m: string) => void = console.log): AlertSender {
  return {
    async send(alert) {
      log(`[alert] ${formatAlertMessage(alert).replace(/\n/g, " | ")}`);
      return "console";
    },
  };
}

export interface AlertRunResult { sent: BudgetAlert[]; failed: { alert: BudgetAlert; error: string }[] }

export async function runBudgetAlerts(db: Db, opts: { thresholds: number[]; sender: AlertSender; webhookConfigured: boolean; dryRun?: boolean }): Promise<AlertRunResult> {
  const pending = pendingAlerts(db, opts.thresholds, opts.webhookConfigured);
  const result: AlertRunResult = { sent: [], failed: [] };
  if (opts.dryRun) {
    const top = new Map<string, BudgetAlert>();
    for (const a of pending) if ((top.get(a.projectCode)?.thresholdPct ?? -1) < a.thresholdPct) top.set(a.projectCode, a);
    return { ...result, sent: [...top.values()] };
  }
  const record = db.prepare(
    `INSERT INTO budget_alerts (project_code, threshold_pct, spend_idr, budget_idr, pct_used, delivery, sent_at)
     VALUES (@projectCode, @thresholdPct, @spendIdr, @budgetIdr, @pctUsed, @delivery, @sentAt)
     ON CONFLICT(project_code, threshold_pct) DO UPDATE SET spend_idr = excluded.spend_idr, budget_idr = excluded.budget_idr,
       pct_used = excluded.pct_used, delivery = excluded.delivery, sent_at = excluded.sent_at`,
  );
  // A project that crosses several thresholds in one run gets one message,
  // for the highest threshold; the lower ones are recorded as covered by it.
  const byProject = new Map<string, BudgetAlert[]>();
  for (const a of pending) byProject.set(a.projectCode, [...(byProject.get(a.projectCode) ?? []), a]);
  for (const group of byProject.values()) {
    group.sort((a, b) => b.thresholdPct - a.thresholdPct);
    const top = group[0];
    try {
      const delivery = await opts.sender.send(top);
      const sentAt = new Date().toISOString();
      for (const a of group) record.run({ ...a, delivery, sentAt });
      result.sent.push(top);
    } catch (err) {
      result.failed.push({ alert: top, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

export function resetAlerts(db: Db): number {
  return db.prepare(`DELETE FROM budget_alerts`).run().changes;
}
