import Link from "next/link";
import { StackedBars, type Row, type Series } from "./components/charts";
import { Badge, BudgetBar, ButtonLink, Empty, PageTitle, Section, Table } from "./components/ui";
import { dashboardData } from "./lib/data";
import { idr, paceText, pct, PROJECT_COLOURS, signedIdr, SOURCE_LABEL, statusOf, UNASSIGNED_COLOUR, weekLabel } from "./lib/format";

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

  return (
    <>
      <PageTitle
        title="Dashboard"
        lede={hasData
          ? <><strong className="text-ink">{idr(d.totals.spendIdr)}</strong> spent of {idr(d.totals.budgetIdr)} across all projects ({pct(totalPct)}). All amounts in IDR, times in WIB.</>
          : "All amounts in IDR, times in WIB."}
        action={!hasData ? <ButtonLink href="/import">Import the data</ButtonLink> : <a href="/export" className="text-sm underline underline-offset-2">Download all records (CSV)</a>}
      />

      {hasData && (attention.length > 0 || d.unassignedCount > 0 || d.outliers.length > 0) ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attention.length > 0 ? (
            <div className="rounded-lg border border-line bg-card p-4 text-sm">
              <p className="font-semibold">{attention.length} project(s) need attention</p>
              <ul className="mt-1 space-y-0.5">
                {attention.map((p) => { const s = statusOf(p.pctUsed, d.thresholds); return <li key={p.code}><Link className="underline" href={`/projects/${p.code}`}>{p.code}</Link> is at {pct(p.pctUsed)} <Badge status={s} /></li>; })}
              </ul>
            </div>
          ) : null}
          {d.unassignedCount > 0 ? (
            <div className="rounded-lg border border-line bg-card p-4 text-sm">
              <p className="font-semibold">{d.unassignedCount} record(s) are not linked to a project</p>
              <p className="mt-1 text-ink-muted">{idr(d.totals.unassignedIdr)} is missing from every budget until someone says which project each label belongs to.</p>
              <Link className="mt-2 inline-block underline" href="/review">Review labels</Link>
            </div>
          ) : null}
          {d.outliers.length > 0 ? (
            <div className="rounded-lg border border-line bg-card p-4 text-sm">
              <p className="font-semibold">{d.outliers.length} unusually large charge(s)</p>
              <p className="mt-1 text-ink-muted">{idr(d.outliers.reduce((s, r) => s + r.amountIdr, 0))} in charges at least 8 times the usual amount for their vendor and item. Worth a look before anyone acts on the budgets.</p>
              <a className="mt-2 inline-block underline" href="#unusual">See them</a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5">
        <Section title="Spend vs budget per project" hint={<>Most urgent first. Warning at {warnAt.join("% and ")}%, over budget at 100%; the tracker posts an alert to the webhook when a project crosses a threshold. "At this pace" is a straight line from the average of the last four weeks of data. Open a project for its records.</>}>
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
        </Section>

        {hasData ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Spend by tool / vendor" hint="Each bar is one vendor, split by project.">
              <StackedBars rows={vendorRows} series={series} />
              <div className="mt-3">
                <Table label="Spend by vendor">
                  <thead><tr><th>Vendor</th><th className="text-right">Spend</th><th className="text-right">Share</th><th className="text-right">Records</th></tr></thead>
                  <tbody>{d.vendors.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td className="text-right">{idr(v.spendIdr)}</td><td className="text-right">{pct(d.totals.spendIdr ? (v.spendIdr / d.totals.spendIdr) * 100 : 0)}</td><td className="text-right">{v.recordCount}</td></tr>)}</tbody>
                </Table>
              </div>
            </Section>
            <Section title="Weekly spend" hint="Weeks start on Monday (WIB), split by project. Refunds reduce the week they were issued in.">
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
          <Section id="unusual" title={`Unusually large charges (${d.outliers.length})`} hint="Charges at least 8 times the median for the same vendor and item, compared across every project. They are counted in the budgets above; this list exists so someone checks them against the vendor invoice.">
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
