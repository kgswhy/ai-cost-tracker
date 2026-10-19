import Link from "next/link";
import { StackedBars, type Row, type Series } from "./components/charts";
import { Badge, BudgetBar, ButtonLink, Empty, PageTitle, Section, Table } from "./components/ui";
import { dashboardData } from "./lib/data";
import { daysSinceWib, idr, idrShort, paceText, pct, PROJECT_COLOURS, signedIdr, SOURCE_LABEL, statusOf, UNASSIGNED_COLOUR, weekLabel, wib, wibDay } from "./lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const d = dashboardData();
  const hasData = d.totals.recordCount > 0;
  const warnAt = d.thresholds.filter((t) => t < 100);

  // Colour follows the project's position in projects.csv order, not the urgency sort, so it stays stable across pages.
  const colourIndex = [...d.projects].sort((a, b) => a.code.localeCompare(b.code)).map((p) => p.code);
  const series: Series[] = [
    ...colourIndex.map((code, i) => ({ key: code, label: code, colour: PROJECT_COLOURS[i % PROJECT_COLOURS.length] })),
    { key: "__unassigned", label: "Unassigned", colour: UNASSIGNED_COLOUR },
  ];
  const keyOf = (code: string | null) => code ?? "__unassigned";
  const vendorRows: Row[] = d.vendors.map((v) => {
    const row: Row = { name: v.vendor };
    for (const s of series) row[s.key] = 0;
    for (const x of d.vendorByProject) if (x.vendor === v.vendor) row[keyOf(x.projectCode)] = x.spendIdr;
    return row;
  });
  const weeks = [...new Set(d.weekly.map((w) => w.weekStart))].sort();
  const weekRows: Row[] = weeks.map((w) => {
    const row: Row = { name: weekLabel(w).replace("Week of ", "") };
    for (const s of series) row[s.key] = 0;
    for (const x of d.weekly) if (x.weekStart === w) row[keyOf(x.projectCode)] = x.spendIdr;
    return row;
  });
  const weekTotals = weeks.map((w) => d.weekly.filter((x) => x.weekStart === w).reduce((s, x) => s + x.spendIdr, 0));
  const totalPct = d.totals.budgetIdr ? (d.totals.spendIdr / d.totals.budgetIdr) * 100 : 0;
  const attention = d.projects.filter((p) => statusOf(p.pctUsed, d.thresholds).cls !== "ok");
  const c = d.checklist;
  const staleDays = c.newestRecordWib ? daysSinceWib(c.newestRecordWib) : null;
  const dataIsStale = staleDays !== null && staleDays > 7;
  type Step = { n: number; title: string; state: "done" | "todo" | "warn"; summary: React.ReactNode; href: string; cta: string };
  const steps: Step[] = [
    {
      n: 1, title: "Bring in this week's data", href: "/import", cta: "Open Import",
      state: !c.lastImportAt ? "todo" : c.sourcesFailed.length || dataIsStale ? "warn" : "done",
      summary: !c.lastImportAt
        ? "No import has run yet."
        : <>Last import {wib(c.lastImportAt)}, {c.sourcesOk} of {c.sourcesTotal} sources OK{c.sourcesFailed.length ? <span className="text-over"> ({c.sourcesFailed.map((s) => SOURCE_LABEL[s] ?? s).join(", ")} failed)</span> : null}. Newest transaction {c.newestRecordWib ? wibDay(c.newestRecordWib) : "none"}{staleDays !== null ? ` (${staleDays} day${staleDays === 1 ? "" : "s"} ago)` : ""}.{dataIsStale ? " Upload newer vendor exports to catch up." : ""}</>,
    },
    {
      n: 2, title: "Say which project unknown names belong to", href: "/review", cta: "Review names",
      state: c.labelsWaiting === 0 ? "done" : "todo",
      summary: c.labelsWaiting === 0
        ? "Every transaction is linked to a project."
        : <>{c.labelsWaiting} project name{c.labelsWaiting === 1 ? "" : "s"} nobody recognised, worth {idrShort(d.totals.unassignedIdr)} across {d.unassignedCount} transaction{d.unassignedCount === 1 ? "" : "s"}. That money is in no budget yet.</>,
    },
    {
      n: 3, title: "Check the budgets", href: "#budgets", cta: "See the table",
      state: attention.length === 0 && d.outliers.length === 0 ? "done" : "warn",
      summary: <>
        {attention.length === 0 ? "Every project is on track." : <>{attention.map((p, i) => { const s = statusOf(p.pctUsed, d.thresholds); return <span key={p.code}>{i ? ", " : ""}<Link className="underline" href={`/projects/${p.code}`}>{p.code}</Link> {pct(p.pctUsed)} <Badge status={s} /></span>; })}.</>}
        {d.outliers.length ? <> Also <a className="underline" href="#unusual">{d.outliers.length} unusually large charge{d.outliers.length === 1 ? "" : "s"}</a> ({idrShort(d.outliers.reduce((s, r) => s + r.amountIdr, 0))}) to check against the invoices.</> : null}
      </>,
    },
    {
      n: 4, title: "Make sure the team was told", href: "/alerts", cta: "Open Alerts",
      state: !c.webhookConfigured ? "warn" : c.alertsPending ? "todo" : "done",
      summary: !c.webhookConfigured
        ? "No Discord or Slack channel is connected, so alerts are only recorded here. Ask the developer to set the webhook."
        : c.alertsPending ? `${c.alertsPending} budget crossing(s) have not been announced yet.` : `${c.alertsSent} alert${c.alertsSent === 1 ? "" : "s"} sent so far; nothing is waiting.`,
    },
  ];

  return (
    <>
      <PageTitle
        title="Dashboard"
        lede={hasData
          ? <><strong className="text-ink">{idr(d.totals.spendIdr)}</strong> spent of {idr(d.totals.budgetIdr)} across all projects ({pct(totalPct)}). All amounts in IDR, times in WIB.</>
          : "All amounts in IDR, times in WIB."}
        action={!hasData ? <ButtonLink href="/import">Import the data</ButtonLink> : <a href="/export" className="text-sm underline underline-offset-2">Download every transaction (CSV)</a>}
      />

      {hasData ? (
        <section aria-labelledby="checklist" className="mb-6 rounded-lg border border-line bg-card p-4 sm:p-5">
          <h2 id="checklist" className="text-base font-semibold">This week, in order</h2>
          <p className="mt-1 text-sm text-ink-muted">The same four steps every week. Each line shows where that step stands right now.</p>
          <ol className="mt-4 grid gap-3 lg:grid-cols-2">
            {steps.map((s) => {
              const tone = { done: "border-ok-bg bg-ok-bg/40", todo: "border-line bg-paper", warn: "border-warn-bg bg-warn-bg/40" }[s.state];
              const mark = { done: <span className="text-ok" aria-label="done">done</span>, todo: <span className="text-ink-muted" aria-label="to do">to do</span>, warn: <span className="text-warn" aria-label="needs attention">needs attention</span> }[s.state];
              return (
                <li key={s.n} className={`rounded-md border p-3 text-sm ${tone}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{s.n}. {s.title}</p>
                    <p className="text-xs font-semibold">{mark}</p>
                  </div>
                  <p className="mt-1 text-ink-muted">{s.summary}</p>
                  {s.href.startsWith("#") ? <a href={s.href} className="mt-2 inline-block underline">{s.cta}</a> : <Link href={s.href} className="mt-2 inline-block underline">{s.cta}</Link>}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <div className="grid gap-5">
        <Section id="budgets" title="Spend vs budget per project" hint={<>Most urgent first. A project turns amber at {warnAt.join("% and ")}% of its budget and red at 100%; the team is alerted when that happens. Click a project code to see every transaction behind the number.</>}>
          <Table label="Spend vs budget per project">
            <thead><tr><th>Project</th><th>Client</th><th className="text-right">Spend</th><th className="text-right">Budget</th><th className="text-right">Used</th><th className="w-[22%]">Budget used</th><th>Status</th><th>At this pace</th></tr></thead>
            <tbody>
              {d.projects.map((p) => { const s = statusOf(p.pctUsed, d.thresholds); return (
                <tr key={p.code}>
                  <td><Link href={`/projects/${p.code}`} className="font-semibold underline-offset-2 hover:underline">{p.code}</Link><br /><span className="text-ink-muted">{p.name}</span></td>
                  <td>{p.client}</td>
                  <td className="text-right">{idr(p.spendIdr)}</td>
                  <td className="text-right">{idr(p.budgetIdr)}</td>
                  <td className="text-right font-semibold">{pct(p.pctUsed)}</td>
                  <td><BudgetBar pctUsed={p.pctUsed} status={s} /></td>
                  <td><Badge status={s} /></td>
                  <td className="text-ink-muted">{paceText(p.pace)}</td>
                </tr>); })}
            </tbody>
          </Table>
          {!hasData ? <Empty>No usage imported yet. Go to Import to pull Vendor A, Vendor B, Vendor C and the ops sheet; spend and the charts fill in from there.</Empty> : null}
          {hasData ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink-muted underline-offset-2 hover:underline">What the columns mean</summary>
              <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold">Spend</dt><dd className="text-ink-muted">Everything charged to the project so far, from all four sources, converted to rupiah. Refunds are already subtracted.</dd>
                <dt className="font-semibold">Budget</dt><dd className="text-ink-muted">The total agreed for the project, from the projects list.</dd>
                <dt className="font-semibold">Used</dt><dd className="text-ink-muted">Spend as a share of budget. Amber from {warnAt[0] ?? 80}%, red from 100%.</dd>
                <dt className="font-semibold">At this pace</dt><dd className="text-ink-muted">Take the average weekly spend of the last four weeks and extend it in a straight line. It does not know the production schedule, so read it as "worth checking", not as a forecast.</dd>
              </dl>
            </details>
          ) : null}
        </Section>

        {hasData ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Spend by tool / vendor" hint="Where the money goes. Each bar is one vendor or tool, split by project.">
              <StackedBars rows={vendorRows} series={series} />
              <div className="mt-3">
                <Table label="Spend by vendor">
                  <thead><tr><th>Vendor</th><th className="text-right">Spend</th><th className="text-right">Share</th><th className="text-right">Records</th></tr></thead>
                  <tbody>{d.vendors.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td className="text-right">{idr(v.spendIdr)}</td><td className="text-right">{pct(d.totals.spendIdr ? (v.spendIdr / d.totals.spendIdr) * 100 : 0)}</td><td className="text-right">{v.recordCount}</td></tr>)}</tbody>
                </Table>
              </div>
            </Section>
            <Section title="Weekly spend" hint="How spending moves over time. Weeks start on Monday (WIB), split by project. Refunds reduce the week they were issued in.">
              <StackedBars rows={weekRows} series={series} />
              <div className="mt-3">
                <Table label="Spend per week">
                  <thead><tr><th>Week</th><th className="text-right">Spend</th><th className="text-right">vs previous week</th></tr></thead>
                  <tbody>{weeks.map((w, i) => <tr key={w}><td>{weekLabel(w)}</td><td className="text-right">{idr(weekTotals[i])}</td><td className="text-right">{i === 0 ? <span className="text-ink-muted">first week</span> : signedIdr(weekTotals[i] - weekTotals[i - 1])}</td></tr>)}</tbody>
                </Table>
              </div>
            </Section>
          </div>
        ) : null}

        {hasData && d.outliers.length > 0 ? (
          <Section id="unusual" title={`Unusually large charges (${d.outliers.length})`} hint="Charges at least 8 times what the same vendor usually bills for the same kind of job, compared across every project. They are already counted in the budgets above; this list exists so someone checks them against the vendor invoice before acting on the numbers.">
            <Table label="Unusually large charges">
              <thead><tr><th>When (WIB)</th><th>Project</th><th>Vendor</th><th>Item</th><th className="text-right">Amount</th><th className="text-right">Usual amount</th><th>Source</th></tr></thead>
              <tbody>{d.outliers.map((r) => (
                <tr key={r.id}>
                  <td>{r.occurredAtWib}</td>
                  <td>{r.projectCode ? <Link href={`/projects/${r.projectCode}`} className="underline">{r.projectCode}</Link> : <span className="text-ink-muted">not linked</span>}</td>
                  <td>{r.vendor}</td><td>{r.item}</td>
                  <td className="text-right font-semibold">{idr(r.amountIdr)}</td>
                  <td className="text-right text-ink-muted">{idr(r.verdict.medianIdr ?? 0)} ({Math.round(r.verdict.ratio ?? 0)}x)</td>
                  <td>{SOURCE_LABEL[r.source] ?? r.source}</td>
                </tr>))}</tbody>
            </Table>
          </Section>
        ) : null}
      </div>
    </>
  );
}
