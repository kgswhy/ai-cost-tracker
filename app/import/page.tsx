import { discardUploadAction, runImportAction, uploadAction } from "../actions";
import { ActionButton, UploadForm } from "../components/forms";
import { Empty, PageHeader, Section, Table, Tag } from "../components/ui";
import { importPageData } from "../lib/data";
import { SOURCE_LABEL, wib } from "../lib/format";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const d = importPageData();
  return (
    <>
      <PageHeader
        step="Langkah 1 dari 4"
        title="Import data"
        lede="Masukkan data minggu ini. Ganti export vendor atau spreadsheet manual kalau ada file yang lebih baru, lalu jalankan import. Menjalankannya berkali-kali tidak pernah menghitung data yang sama dua kali."
      />

      <Section id="files" title="1. File yang dipakai" hint="Vendor C ditarik langsung dari API-nya. Tiga sumber lain dibaca dari file di bawah: file contoh bawaan, atau file terakhir yang kamu unggah.">
        <ul>
          {d.files.map((f) => (
            <li key={f.source} className="grid gap-3 border-t border-line-soft py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="text-sm">
                <p className="font-semibold">{f.label}</p>
                <p className="text-ink-muted">
                  {f.file.origin === "uploaded"
                    ? <>Diunggah: <span className="font-mono text-xs">{f.file.fileName}</span>, {wib(f.file.updatedAt)}</>
                    : <>File contoh bawaan: <span className="font-mono text-xs">data/{f.file.fileName}</span></>}
                </p>
                {f.file.origin === "uploaded" ? (
                  <div className="mt-2"><ActionButton action={discardUploadAction.bind(null, f.source)} label="Kembali ke file contoh" busyLabel="Menghapus" secondary /></div>
                ) : null}
              </div>
              <UploadForm source={f.source} label={f.label} accept={f.accept.join(",")} action={uploadAction} />
            </li>
          ))}
          <li className="border-t border-line-soft py-3.5 text-sm">
            <p className="font-semibold">Vendor C API</p>
            <p className="text-ink-muted">
              <span className="font-mono text-xs">{d.vendorC.baseUrl}</span>. API key {d.vendorC.keyConfigured ? "sudah diatur" : <span className="text-over">belum diatur: minta developer mengisi VENDOR_C_API_KEY</span>}.
            </p>
          </li>
        </ul>
      </Section>

      <Section id="run" title="2. Jalankan import" hint="Membaca keempat sumber, mengubah ke IDR dan WIB, menghubungkan transaksi ke proyek, lalu memeriksa budget dan mengirim budget alert baru. Sekitar sepuluh detik, karena Vendor C membatasi kecepatan request.">
        <ActionButton action={runImportAction} label="Jalankan import" busyLabel="Mengimport, sekitar 10 detik" />
      </Section>

      <Section id="latest" title="3. Hasil import terakhir per sumber">
        {d.latest.length === 0 ? <Empty>Belum pernah import. Tekan Jalankan import di atas.</Empty> : (
          <Table label="Hasil import terakhir per sumber" minWidth={760}>
            <thead><tr><th>Sumber</th><th>Waktu</th><th>Status</th><th className="text-right">Dibaca</th><th className="text-right">Baru</th><th className="text-right">Diperbarui</th><th className="text-right">Tidak berubah</th><th className="text-right">Dilewati</th><th className="text-right">Dihapus</th></tr></thead>
            <tbody>{d.latest.map((r) => (
              <tr key={r.id}>
                <td>{SOURCE_LABEL[r.source] ?? r.source}</td><td>{wib(r.startedAt)}</td>
                <td>{r.status === "ok" ? <Tag tone="ok">berhasil</Tag> : <><Tag tone="over">gagal</Tag> <span className="text-ink-muted">{r.error}</span></>}</td>
                <td className="text-right font-mono">{r.fetched}</td><td className="text-right font-mono">{r.inserted}</td><td className="text-right font-mono">{r.updated}</td>
                <td className="text-right font-mono">{r.unchanged}</td><td className="text-right font-mono">{r.skipped}</td><td className="text-right font-mono">{r.removed}</td>
              </tr>))}</tbody>
          </Table>
        )}
      </Section>

      <Section id="history" title="Riwayat" hint="Setiap import, terbaru di atas. Buka baris untuk melihat apa yang dilewati importer dan alasannya.">
        {d.history.length === 0 ? <Empty>Belum ada.</Empty> : (
          <ul className="text-sm">
            {d.history.map((r) => (
              <li key={r.id} className="border-t border-line-soft py-1.5">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="w-40 font-medium">{SOURCE_LABEL[r.source] ?? r.source}</span>
                    <span className="text-ink-muted">{wib(r.startedAt)}</span>
                    <span className={r.status === "ok" ? "text-accent" : "text-over"}>{r.status === "ok" ? "berhasil" : "gagal"}</span>
                    <span className="text-ink-muted">{r.status === "ok" ? `${r.inserted} baru, ${r.updated} diperbarui, ${r.unchanged} tidak berubah, ${r.skipped} dilewati${r.removed ? `, ${r.removed} dihapus` : ""}` : r.error}</span>
                    {r.warnings.length ? <span className="text-ink-muted">({r.warnings.length} catatan)</span> : null}
                  </summary>
                  {r.warnings.length ? <ul className="mt-1 list-disc space-y-0.5 pl-6 text-ink-muted">{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <p className="mt-1 pl-1 text-ink-muted">Tidak ada yang dilewati.</p>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
