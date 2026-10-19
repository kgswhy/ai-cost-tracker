import Link from "next/link";
import { checkAlertsAction, clearWebhookAction, resetAlertsAction, saveWebhookAction, testWebhookAction } from "../actions";
import { ActionButton, WebhookForm } from "../components/forms";
import { PROVIDER_LABEL } from "@/src/alerts/webhook";
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
          value={<span className="font-sans text-base font-semibold">{d.webhook ? PROVIDER_LABEL[d.webhook.provider] : "Belum ada tujuan"}</span>}
          note={<span className="text-xs text-ink-muted">{d.webhook ? d.webhook.masked : "Alert hanya dicatat di sini"}</span>}
        />
        <Figure label="Batas peringatan" value={<span className="text-base">{d.thresholds.map((t) => `${t}%`).join(" dan ")}</span>} />
        <Figure
          label="Sudah terkirim"
          value={<span className="text-base">{d.delivered} pesan, {d.projectsSent} proyek</span>}
          note={d.sent.length > d.delivered ? <span className="text-xs text-ink-muted">{d.sent.length - d.delivered} lainnya hanya dicatat, dikirim begitu webhook disimpan</span> : undefined}
        />
      </section>

      <Section id="tujuan" title="Tujuan budget alert" hint="Tempel URL webhook dari channel Slack atau Discord tim. Aplikasi mengenali jenisnya dari URL dan mengirim pesan dalam format yang benar.">
        <p className="mb-4 text-sm">
          {d.webhook ? (
            <>Sekarang dikirim ke <strong>{PROVIDER_LABEL[d.webhook.provider]}</strong> <span className="font-mono text-[13px]">{d.webhook.masked}</span>, {d.webhook.origin === "web" ? "diatur dari halaman ini." : "diatur developer lewat file .env."}</>
          ) : (
            <span className="text-warn">Belum ada tujuan. Budget alert hanya dicatat di aplikasi sampai URL disimpan.</span>
          )}
        </p>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <WebhookForm action={saveWebhookAction} hasUrl={Boolean(d.webhook)} />
            {d.webhook ? (
              <div className="flex flex-wrap gap-6">
                <ActionButton action={testWebhookAction} label="Kirim pesan uji" busyLabel="Mengirim" secondary />
                {d.webhook.origin === "web" ? (
                  <ActionButton
                    action={clearWebhookAction}
                    label="Hapus URL"
                    busyLabel="Menghapus"
                    secondary
                    confirm={d.envFallback ? "URL dari halaman ini dihapus dan aplikasi kembali memakai webhook dari .env. Lanjutkan?" : "URL dihapus dan budget alert hanya dicatat di aplikasi. Lanjutkan?"}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
          <details className="border-t border-line-soft pt-2 text-sm lg:border-t-0 lg:pt-0">
            <summary className="inline-flex min-h-9 cursor-pointer items-center font-medium text-accent underline">Cara mendapatkan URL webhook</summary>
            <div className="mt-2 space-y-3 leading-relaxed text-ink-muted">
              <div>
                <p className="font-semibold text-ink">Slack</p>
                <ol className="list-decimal space-y-0.5 pl-5">
                  <li>Buka api.slack.com/apps, klik Create New App, pilih From scratch.</li>
                  <li>Buka Incoming Webhooks dan aktifkan.</li>
                  <li>Klik Add New Webhook to Workspace, pilih channel, lalu Allow.</li>
                  <li>Salin URL yang diawali https://hooks.slack.com/services/.</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-ink">Discord</p>
                <ol className="list-decimal space-y-0.5 pl-5">
                  <li>Buka Server Settings, lalu Integrations, lalu Webhooks.</li>
                  <li>Klik New Webhook dan pilih channel.</li>
                  <li>Klik Copy Webhook URL, yang diawali https://discord.com/api/webhooks/.</li>
                </ol>
              </div>
              <p>Perlakukan URL ini seperti password: siapa pun yang memegangnya bisa mengirim pesan ke channel itu. Setelah disimpan, aplikasi hanya menampilkan potongannya.</p>
            </div>
          </details>
        </div>
      </Section>

      <div className="grid items-start gap-10 border-t border-line md:grid-cols-2 mt-8">
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
                      <span className="text-[13px] opacity-75">{wib(a.sentAt)}{a.delivery === "console" ? " · hanya dicatat" : ""}</span>
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
