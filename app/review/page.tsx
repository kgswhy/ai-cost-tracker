import { linkLabelAction } from "../actions";
import { LinkLabelForm } from "../components/forms";
import { Empty, Figure, PageHeader, Section, Table } from "../components/ui";
import { reviewPageData } from "../lib/data";
import { dayId, num, SOURCE_LABEL } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ selesai?: string }> }) {
  const { selesai } = await searchParams;
  const d = reviewPageData();
  const projects = d.projects.map((p) => ({ code: p.code, name: p.name }));
  const named = d.groups.filter((g) => g.label.trim() !== "");
  return (
    <>
      <PageHeader
        step="Langkah 2 dari 4"
        title="Nama tak dikenal"
        lede={'Nama proyek diketik manual di tiap tool vendor, jadi proyek yang sama bisa muncul sebagai "kmd02", "Kopi Malam" atau "KMD 02". Nama di bawah tidak cocok dengan proyek mana pun. Pilih proyeknya sekali, dan semua transaksi dengan nama itu pindah ke sana, sekarang dan di setiap import berikutnya.'}
      />

      {selesai ? <p role="status" className="mt-5 border-l-4 border-accent bg-ok-bg px-3.5 py-2.5 text-sm font-medium">{selesai}</p> : null}

      <section aria-label="Jumlah" className="flex flex-wrap gap-x-10 gap-y-4 border-b border-line py-5">
        <Figure label="Nama menunggu" value={named.length} />
        <Figure label="Transaksi tanpa proyek" value={d.totalCount} />
        <Figure label="Rupiah belum masuk budget" value={num(d.totalIdr)} />
      </section>

      <Section
        id="names"
        title="Nominal terbesar dulu"
        hint={'Buka "Lihat transaksi" kalau perlu konteks sebelum memilih. Kalau memang bukan proyek, pilih "Bukan proyek, tandai sudah dicek" supaya tidak muncul lagi.'}
      >
        {d.groups.length === 0 ? <Empty>Semua transaksi sudah punya proyek atau sudah dicek.</Empty> : (
          <ul>
            {d.groups.map((g) => (
              <li key={g.label || "(kosong)"} className="border-t border-line py-3.5">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-2.5">
                  <div className="min-w-0 flex-[1_1_260px]">
                    <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                      <span className="bg-[#f2f2f2] px-1.5 py-0.5 font-mono text-[15px]">{g.label || "(kosong)"}</span>
                      <span className="font-mono text-[15px] font-medium">Rp {num(g.spendIdr)}</span>
                    </p>
                    <p className="mt-1.5 text-[13px] text-ink-muted">
                      {g.recordCount} transaksi dari {g.sources.split(",").map((s) => SOURCE_LABEL[s] ?? s).join(" dan ")}, terakhir {dayId(g.lastSeenWib)}.
                    </p>
                  </div>
                  <div className="min-w-0 flex-[1_1_380px]">
                    {g.label.trim()
                      ? <LinkLabelForm label={g.label} projects={projects} action={linkLabelAction} />
                      : <p className="text-sm leading-relaxed">Tidak ada nama yang diketik, jadi tidak bisa dicocokkan. Minta orang yang menjalankan pekerjaan itu mengisi nama proyek di tool vendor atau di spreadsheet manual.</p>}
                  </div>
                </div>
                <details className="mt-1.5">
                  <summary className="inline-flex min-h-9 cursor-pointer items-center text-[13px] text-accent underline">Lihat {g.recordCount} transaksi</summary>
                  <div className="mt-2">
                    <Table label={`Transaksi dengan nama ${g.label || "kosong"}`} minWidth={560}>
                      <thead><tr><th>Tanggal</th><th>Vendor</th><th>Item</th><th className="text-right">Nominal</th></tr></thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={`${r.source}-${r.externalId}`}>
                            <td>{dayId(r.occurredAtWib)}</td><td>{r.vendor}</td><td>{r.item}</td><td className="text-right font-mono">{num(r.amountIdr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 max-w-3xl border-t border-line pt-3.5 text-[13px] text-ink-muted">Ragu? Biarkan saja. Transaksi tanpa proyek tetap terlihat di Dashboard, jadi tidak ada uang yang hilang diam-diam.</p>
      </Section>

      {d.userAliases.length || d.reviewed.length ? (
        <Section id="decided" title="Sudah diputuskan di halaman ini" hint="Dipakai di setiap import berikutnya. Nama bawaan ada di config/project_aliases.json.">
          <Table label="Nama yang sudah diputuskan" minWidth={480}>
            <thead><tr><th>Nama</th><th>Keputusan</th><th>Tanggal</th></tr></thead>
            <tbody>
              {d.userAliases.map((a) => <tr key={`a-${a.label}`}><td className="font-mono">{a.label}</td><td>{a.projectCode}</td><td>{dayId(a.createdAt)}</td></tr>)}
              {d.reviewed.map((r) => <tr key={`r-${r.label}`}><td className="font-mono">{r.label}</td><td className="text-ink-muted">Bukan proyek</td><td>{dayId(r.createdAt)}</td></tr>)}
            </tbody>
          </Table>
        </Section>
      ) : null}
    </>
  );
}
