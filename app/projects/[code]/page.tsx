import Link from "next/link";
import { notFound } from "next/navigation";
import { StackedBars } from "../../components/charts";
import { Badge, BudgetBar, Empty, PageTitle, Section, Table } from "../../components/ui";
import { projectData } from "../../lib/data";
import { idr, paceText, pct, PROJECT_COLOURS, signedIdr, SOURCE_LABEL, statusOf, weekLabel } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = projectData(code.toUpperCase());
  if (!d) notFound();
  const { project: p } = d;
  const s = statusOf(p.pctUsed, d.thresholds);
  const colour = PROJECT_COLOURS[0];
  const weekRows = d.weekly.map((w) => ({ name: weekLabel(w.weekStart).replace("Week of ", ""), spend: w.spendIdr }));
  const fmtOriginal = (r: { originalAmount: number; originalCurrency: string }) =>
    r.originalCurrency === "CREDIT" ? `${r.originalAmount} credits` : r.originalCurrency === "USD" ? `$${r.originalAmount.toFixed(2)}` : idr(r.originalAmount);

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/" className="underline">Dashboard</Link> <span className="text-ink-muted">/ {p.code}</span></p>
      <PageTitle title={`${p.code} ${p.name}`} lede={<>{p.client}. <strong className="text-ink">{idr(p.spendIdr)}</strong> of {idr(p.budgetIdr)} used ({pct(p.pctUsed)}), {p.recordCount} record(s).</>} action={<Badge status={s} />} />
      <div className="mb-6 max-w-xl"><BudgetBar pctUsed={p.pctUsed} status={s} /></div>

      <div className="grid gap-5">
        <Section title="At this pace" hint="A straight line from the average of the last four weeks of data. It knows nothing about the production schedule, so treat it as a prompt to check, not a forecast.">
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-ink-muted">Average per week</dt><dd className="text-lg font-semibold">{d.pace.weeklyIdr === null ? "No history" : idr(d.pace.weeklyIdr)}</dd></div>
            <div><dt className="text-ink-muted">Latest week vs average</dt><dd className="text-lg font-semibold">{d.pace.latestVsAverage === null ? "n/a" : `${Math.round(d.pace.latestVsAverage * 100)}%`}</dd></div>
            <div><dt className="text-ink-muted">{d.pace.remainingIdr >= 0 ? "Remaining budget" : "Over budget by"}</dt><dd className="text-lg font-semibold">{idr(Math.abs(d.pace.remainingIdr))}</dd></div>
            <div><dt className="text-ink-muted">Projection</dt><dd className="text-lg font-semibold">{paceText(d.pace)}</dd></div>
          </dl>
          <p className="mt-3 text-sm"><a href={`/export?project=${p.code}`} className="underline underline-offset-2">Download this project's records (CSV)</a></p>
        </Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="By tool / vendor">
            {d.vendors.length === 0 ? <Empty>No spend recorded for this project yet.</Empty> : (
              <Table label="Spend by vendor for this project">
                <thead><tr><th>Vendor</th><th className="text-right">Spend</th><th className="text-right">Share</th><th className="text-right">Records</th></tr></thead>
                <tbody>{d.vendors.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td className="text-right">{idr(v.spendIdr)}</td><td className="text-right">{pct(p.spendIdr ? (v.spendIdr / p.spendIdr) * 100 : 0)}</td><td className="text-right">{v.recordCount}</td></tr>)}</tbody>
              </Table>
            )}
          </Section>
          <Section title="Weekly spend" hint="Weeks start on Monday (WIB).">
            {weekRows.length === 0 ? <Empty>Nothing to chart yet.</Empty> : (
              <>
                <StackedBars rows={weekRows} series={[{ key: "spend", label: p.code, colour }]} height={240} />
                <div className="mt-3">
                  <Table label="Spend per week for this project">
                    <thead><tr><th>Week</th><th className="text-right">Spend</th><th className="text-right">vs previous week</th></tr></thead>
                    <tbody>{d.weekly.map((w, i) => <tr key={w.weekStart}><td>{weekLabel(w.weekStart)}</td><td className="text-right">{idr(w.spendIdr)}</td><td className="text-right">{i === 0 ? <span className="text-ink-muted">first week</span> : signedIdr(w.spendIdr - d.weekly[i - 1].spendIdr)}</td></tr>)}</tbody>
                  </Table>
                </div>
              </>
            )}
          </Section>
        </div>

        <Section title={`Records (${d.records.length})`} hint="Newest first. Refunds show as negative amounts and name the charge they reverse. A charge at least 8 times the usual amount for its vendor and item is marked so it gets checked against the invoice.">
          {d.records.length === 0 ? <Empty>No records linked to this project.</Empty> : (
            <Table label="Records for this project">
              <thead><tr><th>When (WIB)</th><th>Source</th><th>Vendor</th><th>Item</th><th>Label typed</th><th className="text-right">Original</th><th className="text-right">IDR</th></tr></thead>
              <tbody>{d.records.map((r) => (
                <tr key={r.id} className={r.amountIdr < 0 ? "text-ink-muted" : ""}>
                  <td>{r.occurredAtWib}</td><td>{SOURCE_LABEL[r.source] ?? r.source}</td><td>{r.vendor}</td>
                  <td>{r.item}{r.refundOf ? <span className="text-ink-muted"> (reverses {r.refundOf})</span> : null}{r.outlier ? <span className="ml-2 inline-block rounded bg-warn-bg px-1.5 py-0.5 text-xs font-semibold text-warn">{Math.round(r.outlier.ratio ?? 0)}x the usual</span> : null}</td>
                  <td><code className="rounded bg-paper px-1 text-xs">{r.projectLabel}</code></td>
                  <td className="text-right">{fmtOriginal(r)}</td><td className="text-right">{idr(r.amountIdr)}</td>
                </tr>))}</tbody>
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
