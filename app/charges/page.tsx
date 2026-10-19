import Link from "next/link";
import { Empty, PageHeader, Section, Table } from "../components/ui";
import { chargesData } from "../lib/data";
import { dayId, num, pctRound, SOURCE_LABEL } from "../lib/format";

export const dynamic = "force-dynamic";

export default function ChargesPage() {
  const d = chargesData();
  const affected = d.projects.filter((p) => p.pctWithoutFlagged !== null);
  return (
    <>
      <PageHeader
        step="Langkah 3 dari 4"
        title="Tagihan janggal"
        lede="Tagihan yang nilainya minimal 8 kali biasanya untuk vendor dan jenis pekerjaan yang sama, dibandingkan dengan semua proyek. Tagihan ini sudah ikut dihitung di budget. Cocokkan dengan invoice vendor sebelum mengambil keputusan dari angkanya."
      />

      <Section id="list" title={`${d.outliers.length} tagihan perlu dicek`}>
        {d.outliers.length === 0 ? <Empty>Tidak ada tagihan yang janggal.</Empty> : (
          <Table label="Tagihan janggal" minWidth={820}>
            <thead>
              <tr><th>Tanggal</th><th>Proyek</th><th>Vendor</th><th>Item</th><th className="text-right">Nominal</th><th className="text-right">Biasanya</th><th>Sumber</th></tr>
            </thead>
            <tbody>
              {d.outliers.map((o) => (
                <tr key={o.id}>
                  <td>{dayId(o.occurredAtWib)}</td>
                  <td>{o.projectCode ? <Link href={`/projects/${o.projectCode}`} className="font-mono font-medium text-ink">{o.projectCode}</Link> : <span className="text-ink-muted">tanpa proyek</span>}</td>
                  <td>{o.vendor}</td>
                  <td>{o.item}</td>
                  <td className="text-right font-mono font-medium">{num(o.amountIdr)}</td>
                  <td className="text-right font-mono text-ink-muted">{num(o.verdict.medianIdr ?? 0)} <span className="text-check-ink">({Math.round(o.verdict.ratio ?? 0)}x)</span></td>
                  <td>{SOURCE_LABEL[o.source] ?? o.source} <span className="font-mono text-xs text-ink-muted">{o.externalId}</span></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {affected.length ? (
        <Section id="impact" title="Kalau tagihan ini salah" hint="Persen budget terpakai dengan dan tanpa tagihan di atas.">
          <Table label="Dampak ke budget" minWidth={480}>
            <thead><tr><th>Proyek</th><th className="text-right">Sekarang</th><th className="text-right">Tanpa tagihan janggal</th></tr></thead>
            <tbody>
              {affected.map((p) => (
                <tr key={p.code}>
                  <td><Link href={`/projects/${p.code}`} className="font-mono font-medium text-ink">{p.code}</Link> <span className="text-[13px] text-ink-muted">{p.name}</span></td>
                  <td className="text-right font-mono">{pctRound(p.pctUsed)}</td>
                  <td className="text-right font-mono">{pctRound(p.pctWithoutFlagged!)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      ) : null}
    </>
  );
}
