import Link from "next/link";
import { notFound } from "next/navigation";
import { BudgetBar, CheckNote, Empty, Figure, PageHeader, Section, StatusText, Table, btnSmall } from "../../components/ui";
import { projectData } from "../../lib/data";
import { dayId, idr, jt, num, paceText, pct, pctRound, signedIdr, SOURCE_LABEL, statusOf, STATUS_TEXT } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = projectData(code.toUpperCase());
  if (!d) notFound();
  const { project: p } = d;
  const s = statusOf(p.pctUsed, d.thresholds);
  const warnAt = d.thresholds.find((t) => t < 100) ?? 80;
  const fmtOriginal = (r: { originalAmount: number; originalCurrency: string }) =>
    r.originalCurrency === "CREDIT" ? `${r.originalAmount} kredit` : r.originalCurrency === "USD" ? `$${r.originalAmount.toFixed(2)}` : `Rp ${num(r.originalAmount)}`;
  const maxWeek = Math.max(1, ...d.weekly.map((w) => w.spendIdr));

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/">Dashboard</Link> <span className="text-ink-muted">/ {p.code}</span></p>
      <PageHeader
        title={`${p.code} ${p.name}`}
        lede={<>Klien: {p.client}. {p.recordCount} transaksi.</>}
        actions={<a href={`/export?project=${p.code}`} className={btnSmall}>Unduh transaksi (CSV)</a>}
      />

      <section aria-label="Budget" className="flex flex-wrap gap-x-12 gap-y-6 border-b border-line py-6">
        <div className="min-w-[280px] flex-[2_1_320px]">
          <p className="text-[13px] text-ink-muted">Spend</p>
          <p className="mt-1 font-mono text-[40px] font-medium leading-none tracking-tight">{num(p.spendIdr)}</p>
          <p className="mt-2 text-sm">dari budget {num(p.budgetIdr)}, <strong className={s.cls === "ok" ? "" : STATUS_TEXT[s.cls]}>{pct(p.pctUsed)} budget terpakai</strong> · <StatusText status={s} /></p>
          <div className="mt-3 flex max-w-[420px]"><BudgetBar pctUsed={p.pctUsed} status={s} warnAt={warnAt} thick /></div>
        </div>
        <Figure label={p.pace.remainingIdr >= 0 ? "Sisa budget" : "Lewat budget"} value={num(Math.abs(p.pace.remainingIdr))} tone={p.pace.remainingIdr < 0 ? "over" : undefined} />
        <Figure label="Rata-rata spend per minggu" value={p.pace.weeklyIdr === null ? "-" : num(p.pace.weeklyIdr)} note="4 minggu terakhir" />
        <Figure label="Kalau laju ini berlanjut" value={<span className="font-sans text-base font-semibold">{paceText(p.pace)}</span>} />
      </section>

      {p.pctWithoutFlagged !== null ? (
        <div className="mt-6">
          <CheckNote action={<Link href="/charges" className={btnSmall}>Lihat tagihan</Link>}>
            <strong>Ada tagihan janggal di proyek ini senilai {idr(p.flaggedIdr)}.</strong> Tanpa tagihan itu, budget terpakai {pctRound(p.pctWithoutFlagged)}, bukan {pctRound(p.pctUsed)}.
          </CheckNote>
        </div>
      ) : null}

      <div className="grid gap-12 md:grid-cols-2">
        <Section id="vendors" title="Spend per tool / vendor">
          {d.vendors.length === 0 ? <Empty>Belum ada spend untuk proyek ini.</Empty> : (
            <Table label="Spend per tool / vendor untuk proyek ini" minWidth={360}>
              <thead><tr><th>Vendor</th><th className="text-right">Spend (IDR)</th><th className="text-right">Porsi</th><th className="text-right">Transaksi</th></tr></thead>
              <tbody>{d.vendors.map((v) => <tr key={v.vendor}><td>{v.vendor}</td><td className="text-right font-mono">{num(v.spendIdr)}</td><td className="text-right font-mono">{pct(p.spendIdr ? (v.spendIdr / p.spendIdr) * 100 : 0)}</td><td className="text-right font-mono">{v.recordCount}</td></tr>)}</tbody>
            </Table>
          )}
        </Section>
        <Section id="weeks" title="Spend mingguan" hint="Minggu dimulai Senin. Dalam juta rupiah.">
          {d.weekly.length === 0 ? <Empty>Belum ada data mingguan.</Empty> : (
            <>
              <div className="flex h-[150px] items-end gap-2 border-b border-ink" role="img" aria-label={d.weekly.map((w) => `Minggu ${dayId(w.weekStart)}: ${jt(w.spendIdr)} juta`).join(", ")}>
                {d.weekly.map((w) => (
                  <div key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end">
                    <span className="mb-1 font-mono text-xs">{jt(w.spendIdr)}</span>
                    <span className="block w-full bg-ink" style={{ height: `${(Math.max(0, w.spendIdr) / maxWeek) * 110}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">
                {d.weekly.map((w, i) => (
                  <span key={w.weekStart} className="flex-1 text-center text-xs text-ink-muted">
                    {dayId(w.weekStart)}
                    {i > 0 ? <span className="block font-mono">{signedIdr(w.spendIdr - d.weekly[i - 1].spendIdr).replace("Rp ", "")}</span> : null}
                  </span>
                ))}
              </div>
            </>
          )}
        </Section>
      </div>

      <Section id="records" title={`Transaksi (${d.records.length})`} hint="Terbaru di atas. Refund tampil negatif dan menyebut tagihan yang dibatalkannya. Tagihan minimal 8 kali biasanya ditandai supaya dicek ke invoice." className="mt-4">
        {d.records.length === 0 ? <Empty>Belum ada transaksi untuk proyek ini.</Empty> : (
          <Table label="Transaksi proyek ini" minWidth={880}>
            <thead><tr><th>Waktu (WIB)</th><th>Sumber</th><th>Vendor</th><th>Item</th><th>Nama diketik</th><th className="text-right">Asli</th><th className="text-right">IDR</th></tr></thead>
            <tbody>{d.records.map((r) => (
              <tr key={r.id} className={r.amountIdr < 0 ? "text-ink-muted" : ""}>
                <td className="whitespace-nowrap">{dayId(r.occurredAtWib)}, {r.occurredAtWib.slice(11, 16)}</td>
                <td>{SOURCE_LABEL[r.source] ?? r.source}</td>
                <td>{r.vendor}</td>
                <td>
                  {r.item}
                  {r.refundOf ? <span className="text-ink-muted"> (membatalkan {r.refundOf})</span> : null}
                  {r.outlier ? <span className="ml-2 inline-block bg-check-bg px-1.5 py-0.5 text-xs font-semibold text-check-ink">{Math.round(r.outlier.ratio ?? 0)}x biasanya</span> : null}
                </td>
                <td className="font-mono text-xs">{r.projectLabel}</td>
                <td className="whitespace-nowrap text-right font-mono">{fmtOriginal(r)}</td>
                <td className="text-right font-mono">{num(r.amountIdr)}</td>
              </tr>))}</tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
