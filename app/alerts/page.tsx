import Link from "next/link";
import { checkAlertsAction, resetAlertsAction } from "../actions";
import { ActionButton } from "../components/forms";
import { Empty, Figure, PageHeader, Section, Tag } from "../components/ui";
import { alertsPageData } from "../lib/data";
import { pct, wib } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ pilih?: string }> }) {
  const { pilih } = await searchParams;
  const d = alertsPageData(pilih);
  const warnAt = d.thresholds.find((t) => t < 100) ?? 80;
  const [head, ...body] = d.current ? d.current.message.split("\n") : [];
  return (
    <>
      <PageHeader
        step="Langkah 4 dari 4"
        title="Budget alert"
        lede={`Saat spend sebuah proyek melewati ${warnAt}% budget, notifikasi dikirim ke webhook, misalnya ke aplikasi chat tim atau endpoint lain.${d.thresholds.includes(100) ? " Ada batas kedua di 100% untuk proyek yang sudah lewat budget." : ""} Setiap proyek hanya diberi tahu sekali per batas, jadi import ulang tidak membuat pesan dobel. Pengecekan berjalan otomatis setiap selesai import.`}
      />

      <section aria-label="Pengaturan" className="flex flex-wrap gap-x-10 gap-y-4 border-b border-line py-5">
        <Figure
          label="Dikirim ke"
          value={<span className="font-sans text-base font-semibold">{d.webhookConfigured ? "Webhook tim" : "Belum ada webhook"}</span>}
          note={<span className="text-xs text-ink-muted">{d.webhookConfigured ? "Alamatnya diatur developer" : "Alert hanya dicatat di sini. Minta developer mengisi ALERT_WEBHOOK_URL."}</span>}
        />
        <Figure label="Batas peringatan" value={<span className="text-base">{d.thresholds.map((t) => `${t}%`).join(" dan ")}</span>} />
        <Figure label="Sudah terkirim" value={<span className="text-base">{d.sent.length} pesan, {d.projectsSent} proyek</span>} />
      </section>

      <div className="grid items-start gap-10 md:grid-cols-2">
        <Section id="sent" title="Yang sudah dikirim" hint="Pilih satu baris untuk melihat pesannya persis seperti yang diterima tim.">
          {d.sent.length === 0 ? <Empty>Belum ada alert. Satu dikirim saat sebuah proyek melewati {warnAt}% budget.</Empty> : (
            <ul>
              {d.sent.map((a) => {
                const on = d.current?.key === a.key;
                return (
                  <li key={a.key}>
                    <Link
                      href={`/alerts?pilih=${a.key}`}
                      scroll={false}
                      aria-current={on ? "true" : undefined}
                      className={`grid min-h-12 grid-cols-[72px_96px_64px_minmax(0,1fr)] items-center gap-2.5 border-t border-line-soft px-2.5 py-2 text-sm no-underline ${on ? "bg-ink text-white hover:text-white" : "text-ink hover:bg-line-soft hover:text-ink"}`}
                    >
                      <span className="font-mono font-medium">{a.projectCode}</span>
                      <Tag tone={a.thresholdPct >= 100 ? "over" : "warn"}>Lewat {a.thresholdPct}%</Tag>
                      <span className="font-mono">{pct(a.pctUsed)}</span>
                      <span className="text-[13px] opacity-75">{wib(a.sentAt)}{a.delivery !== "webhook" ? " · hanya dicatat" : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section id="preview" title="Contoh pesan yang dikirim" hint="Setiap pesan memuat proyek, spend saat ini, budget, dan persen budget terpakai.">
          {d.current ? (
            <div className="border border-line bg-side px-4 py-4">
              <p className="mb-2 text-xs text-ink-muted">AI Production Cost Tracker · {wib(d.current.sentAt)}</p>
              <p className={`text-[15px] font-semibold ${d.current.thresholdPct >= 100 ? "text-over" : "text-warn"}`}>{head}</p>
              <p className="mt-1.5 whitespace-pre-line font-mono text-sm leading-7">{body.join("\n")}</p>
            </div>
          ) : <Empty>Belum ada pesan untuk ditampilkan.</Empty>}

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-2 text-[15px] font-semibold">Cek sekarang</h3>
            {d.pending.length ? <p className="mb-2 text-sm text-warn">{d.pending.length} batas sudah terlewati tapi belum diberitahukan.</p> : null}
            <div className="flex flex-wrap gap-6">
              <ActionButton action={checkAlertsAction} label="Periksa budget dan kirim" busyLabel="Mengirim" />
              <ActionButton action={resetAlertsAction} label="Kirim ulang semua (uji coba)" busyLabel="Menghapus" secondary confirm="Ini menghapus catatan alert yang sudah terkirim, jadi pengecekan berikutnya mengirim semuanya lagi. Lanjutkan?" />
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
