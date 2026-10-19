import Link from "next/link";
import { runImportAction } from "./actions";
import { ActionButton } from "./components/forms";
import { BudgetBar, ButtonLink, CheckNote, Empty, Figure, PageHeader, Section, StatusText, Table, btnSmall } from "./components/ui";
import { dashboardData } from "./lib/data";
import { dayId, idr, jt, num, paceText, pct, pctRound, statusOf, STATUS_TEXT } from "./lib/format";

export const dynamic = "force-dynamic";

const listJoin = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} dan ${xs.at(-1)}`);

export default function DashboardPage() {
  const d = dashboardData();
  const warnAt = d.thresholds.find((t) => t < 100) ?? 80;

  if (!d.hasData) {
    return (
      <>
        <PageHeader title="Dashboard" lede="Semua angka dalam IDR, waktu dalam WIB (UTC+7)." />
        <div className="mt-8">
          <Empty>Belum ada data. Buka Import data untuk menarik Vendor A, Vendor B, Vendor C API dan spreadsheet manual; angka dan grafik muncul setelah itu.</Empty>
          <div className="mt-4 text-center"><ButtonLink href="/import">Buka Import data</ButtonLink></div>
        </div>
      </>
    );
  }

  const above = d.projects.filter((p) => p.pctUsed >= warnAt);
  const over = d.projects.filter((p) => p.pctUsed >= 100);
  const budgetIdr = d.totals.budgetIdr;
  const flaggedIdr = d.outliers.reduce((s, o) => s + o.amountIdr, 0);
  const ratios = d.outliers.map((o) => Math.round(o.verdict.ratio ?? 0));
  const ratioText = ratios.length ? (Math.min(...ratios) === Math.max(...ratios) ? `${ratios[0]}` : `${Math.min(...ratios)} sampai ${Math.max(...ratios)}`) : "";
  const outlierVendors = [...new Set(d.outliers.map((o) => o.vendor))];
  const affected = d.projects.filter((p) => p.pctWithoutFlagged !== null);

  const todos: { title: string; body: string; href: string; action: string }[] = [];
  if (d.outliers.length) todos.push({
    title: `Cocokkan ${d.outliers.length} tagihan ${listJoin(outlierVendors)} dengan invoice.`,
    body: affected.length ? `Hasilnya menentukan apakah ${listJoin(affected.map((p) => p.code))} benar-benar ${affected.some((p) => p.pctUsed >= warnAt) ? "mendekati batas" : "sebesar itu"}.` : "Tagihan ini ikut dihitung di budget sampai dicek.",
    href: "/charges", action: "Lihat tagihan",
  });
  for (const p of over) todos.push({
    title: `${p.code} sudah lewat budget ${idr(p.spendIdr - p.budgetIdr)}.`,
    body: `Sepakati tambahan biaya dengan ${p.client} sebelum pekerjaan baru dipesan.`,
    href: `/projects/${p.code}`, action: `Buka ${p.code}`,
  });
  if (d.namesWaiting) todos.push({
    title: `Tentukan proyek untuk ${d.namesWaiting} nama tak dikenal.`,
    body: `${idr(d.totals.unassignedIdr)} belum masuk budget mana pun.`,
    href: "/review", action: "Tentukan proyek",
  });

  const maxVendor = Math.max(...d.vendors.map((v) => v.spendIdr));
  const maxWeek = Math.max(...d.weeks.map((w) => w.spendIdr));

  return (
    <>
      <PageHeader
        title="Dashboard"
        lede={<>Semua angka dalam IDR, waktu dalam WIB (UTC+7). Data mencakup {d.firstDay ? dayId(d.firstDay) : ""} sampai {d.lastDay ? dayId(d.lastDay) : ""} {d.lastDay?.slice(0, 4)}.</>}
        actions={<>
          <ButtonLink href="/import" secondary>Unggah file baru</ButtonLink>
          <ActionButton action={runImportAction} label="Jalankan import" busyLabel="Mengimport, sekitar 10 detik" />
        </>}
      />

      <section aria-label="Total spend" className="flex flex-wrap gap-x-12 gap-y-6 border-b border-line py-7">
        <div className="min-w-[280px] flex-[2_1_320px]">
          <p className="text-[13px] text-ink-muted">Total spend {d.projects.length} proyek</p>
          <p className="mt-1 font-mono text-[44px] font-medium leading-none tracking-tight sm:text-[48px]">{num(d.totals.projectSpendIdr)}</p>
          <p className="mt-2 text-sm">dari total budget {num(budgetIdr)}, <strong>{pct(budgetIdr ? (d.totals.projectSpendIdr / budgetIdr) * 100 : 0)} budget terpakai</strong></p>
          <span className="relative mt-3 block h-2 max-w-[420px] bg-line-soft"><span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${Math.min(100, (d.totals.projectSpendIdr / budgetIdr) * 100)}%` }} /></span>
        </div>
        <Figure label={`Proyek di atas ${warnAt}% budget`} value={`${above.length} dari ${d.projects.length}`} tone={above.length ? "over" : undefined} note={over.length ? `${over.length} sudah lewat budget` : "Belum ada yang lewat budget"} />
        <Figure label="Belum punya proyek" value={num(d.totals.unassignedIdr)} note={d.namesWaiting ? <>Tidak masuk budget mana pun. <Link href="/review">Tentukan proyeknya</Link></> : "Semua nama sudah dicek"} />
      </section>

      <Section id="projects" title="Spend vs budget per proyek" aside={`Garis tipis di tiap bar adalah batas peringatan ${warnAt}%. Klik kode proyek untuk melihat semua transaksinya.`}>
        {d.outliers.length ? (
          <div className="mb-3">
            <CheckNote action={<Link href="/charges" className={btnSmall}>Lihat {d.outliers.length} tagihan</Link>}>
              <strong>Cek dulu sebelum mengambil keputusan.</strong> {d.outliers.length} tagihan {listJoin(outlierVendors)} nilainya {ratioText} kali biasanya, total {idr(flaggedIdr)}.
              {affected.length ? <> Kalau ternyata salah tagih, {listJoin(affected.map((p) => `${p.code} turun dari ${pctRound(p.pctUsed)} ke ${pctRound(p.pctWithoutFlagged!)}`))}.</> : null}
            </CheckNote>
          </div>
        ) : null}
        <Table label="Spend vs budget per proyek" minWidth={860}>
          <thead>
            <tr>
              <th>Proyek</th><th className="text-right">Spend</th><th className="text-right">Budget</th>
              <th className="w-1/4">% budget terpakai</th><th>Status</th><th>Kalau laju 4 minggu terakhir berlanjut</th>
            </tr>
          </thead>
          <tbody>
            {d.projects.map((p) => {
              const s = statusOf(p.pctUsed, d.thresholds);
              return (
                <tr key={p.code}>
                  <td><Link href={`/projects/${p.code}`} className="font-mono font-medium text-ink">{p.code}</Link><br /><span className="text-[13px] text-ink-muted">{p.name}</span></td>
                  <td className="text-right font-mono">{num(p.spendIdr)}</td>
                  <td className="text-right font-mono text-ink-muted">{num(p.budgetIdr)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className={`min-w-[54px] font-mono font-medium ${s.cls === "ok" ? "text-accent" : STATUS_TEXT[s.cls]}`}>{pct(p.pctUsed)}</span>
                      <BudgetBar pctUsed={p.pctUsed} status={s} warnAt={warnAt} />
                    </div>
                    {p.pctWithoutFlagged !== null ? <p className="mt-1 text-xs text-check-ink">{pctRound(p.pctWithoutFlagged)} tanpa tagihan yang sedang dicek</p> : null}
                  </td>
                  <td><StatusText status={s} /></td>
                  <td className="text-[#333333]">{paceText(p.pace)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-2.5 text-xs text-ink-muted">Proyeksi dihitung dari data terakhir ({d.lastDay ? dayId(d.lastDay) : "-"}). Ini perkiraan kasar untuk memicu pengecekan, bukan jadwal produksi.</p>
      </Section>

      <Section id="todo" title="Perlu keputusan minggu ini" hint="Urut dari yang paling penting. Baris hilang sendiri setelah ditangani." className="mt-9 border-t border-line">
        {todos.length === 0 ? <Empty>Tidak ada yang perlu diputuskan minggu ini.</Empty> : (
          <ol>
            {todos.slice(0, 3).map((t, i) => (
              <li key={t.title} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft py-3">
                <span className="min-w-6 font-mono text-[13px] text-[#777777]">{i + 1}</span>
                <p className="min-w-0 flex-[1_1_380px] text-[15px] leading-snug"><strong>{t.title}</strong> {t.body}</p>
                <Link href={t.href} className={btnSmall}>{t.action}</Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <div className="mt-6 grid gap-12 md:grid-cols-2">
        <Section id="vendors" title="Spend per tool / vendor" hint={`Semua proyek, dalam juta rupiah.${flaggedIdr ? " Bagian kuning adalah tagihan yang sedang dicek." : ""}`}>
          <ul>
            {d.vendors.map((v) => (
              <li key={v.vendor} className="grid grid-cols-[112px_minmax(0,1fr)_84px] items-center gap-3 border-t border-line-soft py-2 text-sm">
                <span>{v.vendor}</span>
                <span className="flex h-2.5 bg-[#f2f2f2]" role="img" aria-label={`${v.vendor} ${jt(v.spendIdr)} juta${v.flaggedIdr ? `, termasuk ${jt(v.flaggedIdr)} juta yang sedang dicek` : ""}`}>
                  <span className="h-full bg-ink" style={{ width: `${((v.spendIdr - v.flaggedIdr) / maxVendor) * 100}%` }} />
                  {v.flaggedIdr ? <span className="h-full bg-check" style={{ width: `${(v.flaggedIdr / maxVendor) * 100}%` }} /> : null}
                </span>
                <span className="text-right font-mono text-[13px]">{jt(v.spendIdr)} jt</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="weeks" title="Spend mingguan" hint={`Minggu dimulai Senin. Dalam juta rupiah.${flaggedIdr ? " Bagian kuning adalah tagihan yang sedang dicek." : ""}`}>
          <div className="flex h-[190px] items-end gap-2.5 border-b border-ink" role="img" aria-label={d.weeks.map((w) => `Minggu ${dayId(w.weekStart)}: ${jt(w.spendIdr)} juta`).join(", ")}>
            {d.weeks.map((w) => (
              <div key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1.5 font-mono text-xs">{jt(w.spendIdr)}</span>
                {w.flaggedIdr ? <span className="block w-full bg-check" style={{ height: `${(w.flaggedIdr / maxWeek) * 140}px` }} /> : null}
                <span className={`block w-full ${w.spendIdr === maxWeek ? "bg-accent" : "bg-ink"}`} style={{ height: `${((w.spendIdr - w.flaggedIdr) / maxWeek) * 140}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2.5">
            {d.weeks.map((w) => <span key={w.weekStart} className="flex-1 text-center text-xs text-ink-muted">{dayId(w.weekStart)}</span>)}
          </div>
        </Section>
      </div>
    </>
  );
}
