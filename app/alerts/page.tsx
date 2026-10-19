import { checkAlertsAction, resetAlertsAction } from "../actions";
import { ActionButton } from "../components/forms";
import { Badge, Empty, PageTitle, Section, Table } from "../components/ui";
import { alertsPageData } from "../lib/data";
import { idr, pct, statusOf, wib } from "../lib/format";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  const d = alertsPageData();
  const above = d.projects.filter((p) => p.pctUsed >= (d.thresholds[0] ?? 80));
  return (
    <>
      <PageTitle title="Budget alerts" lede={<>Thresholds: {d.thresholds.join("% and ")}% of budget. Each project and threshold is announced once; the next crossing announces again. Delivery: {d.webhookConfigured ? <>webhook at <code className="rounded bg-paper px-1 text-xs">{d.webhookHost}</code></> : <span className="text-warn">no webhook configured, alerts are only recorded here (set ALERT_WEBHOOK_URL in .env)</span>}.</>} />
      <div className="grid gap-5">
        <Section title="Projects above a threshold right now">
          {above.length === 0 ? <Empty>No project is above {d.thresholds[0] ?? 80}% of its budget.</Empty> : (
            <Table label="Projects above a threshold">
              <thead><tr><th>Project</th><th className="text-right">Spend</th><th className="text-right">Budget</th><th className="text-right">Used</th><th>Status</th></tr></thead>
              <tbody>{above.map((p) => <tr key={p.code}><td className="font-semibold">{p.code} <span className="font-normal text-ink-muted">{p.name}</span></td><td className="text-right">{idr(p.spendIdr)}</td><td className="text-right">{idr(p.budgetIdr)}</td><td className="text-right">{pct(p.pctUsed)}</td><td><Badge status={statusOf(p.pctUsed, d.thresholds)} /></td></tr>)}</tbody>
            </Table>
          )}
        </Section>

        <Section title="Check now" hint={d.pending.length ? `${d.pending.length} crossing(s) have not been announced yet.` : "Alerts also run automatically at the end of every import and after a label is linked."}>
          <div className="flex flex-wrap gap-6">
            <ActionButton action={checkAlertsAction} label="Check budgets and send" busyLabel="Sending" />
            <ActionButton action={resetAlertsAction} label="Forget sent alerts" busyLabel="Clearing" secondary confirm="This forgets every alert already sent, so the next check sends them all again. Continue?" />
          </div>
        </Section>

        <Section title="Sent" hint="What the webhook received, newest first.">
          {d.sent.length === 0 ? <Empty>No alerts yet. One is posted when a project passes {d.thresholds[0] ?? 80}% of its budget.</Empty> : (
            <Table label="Alerts sent">
              <thead><tr><th>Project</th><th>Threshold</th><th className="text-right">Spend at alert</th><th className="text-right">Budget</th><th className="text-right">Used</th><th>Via</th><th>When (WIB)</th></tr></thead>
              <tbody>{d.sent.map((a) => <tr key={`${a.projectCode}-${a.thresholdPct}`}><td className="font-semibold">{a.projectCode}</td><td>{a.thresholdPct}%</td><td className="text-right">{idr(a.spendIdr)}</td><td className="text-right">{idr(a.budgetIdr)}</td><td className="text-right">{pct(a.pctUsed)}</td><td>{a.delivery}</td><td>{wib(a.sentAt)}</td></tr>)}</tbody>
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
