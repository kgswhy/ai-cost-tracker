"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/src/db/connection";
import { addUserAlias, markLabelReviewed, relinkRecords } from "@/src/db/index";
import { loadReferenceData, runImport, type SourceSummary } from "@/src/importers/index";
import { discardUpload, isFileSource, saveUpload, SOURCE_FILES, type FileSource } from "@/src/importers/files";
import { runConfiguredAlerts } from "@/src/alerts/run";
import { resetAlerts, type BudgetAlert } from "@/src/alerts/index";
import { normalizeLabel } from "@/src/normalize/project";
import { configuredWebhook } from "@/src/alerts/run";
import { buildPayload, detectProvider, maskWebhookUrl, postWebhook, PROVIDER_LABEL, TEST_MESSAGE, validateWebhookUrl } from "@/src/alerts/webhook";
import { deleteSetting, setSetting, WEBHOOK_KEY } from "@/src/db/settings";

export interface ActionResult {
  ok: boolean;
  message: string;
  details?: string[];
  summaries?: SourceSummary[];
}

// The sidebar counts live in the layout, so every action refreshes the whole tree.
const refresh = () => revalidatePath("/", "layout");

const alertLine = (a: BudgetAlert) => `${a.projectCode} lewat ${a.thresholdPct}% (sekarang ${a.pctUsed.toFixed(1).replace(".", ",")}%)`;

export async function runImportAction(): Promise<ActionResult> {
  const db = getDb();
  const summaries = await runImport({ db });
  const alerts = await runConfiguredAlerts(db);
  refresh();
  const failed = summaries.filter((s) => s.status === "failed");
  const details = alerts.sent.map((a) => "Budget alert terkirim: " + alertLine(a));
  for (const f of alerts.failed) details.push(`Budget alert untuk ${f.alert.projectCode} gagal: ${f.error}`);
  return {
    ok: failed.length === 0,
    message: failed.length
      ? `${failed.length} sumber gagal, sumber lain tetap ter-import.`
      : "Import selesai. Data yang sama tidak dihitung dua kali: baris yang tidak berubah dibiarkan.",
    details,
    summaries,
  };
}

export async function uploadAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const source = String(form.get("source"));
  const file = form.get("file");
  if (!isFileSource(source)) return { ok: false, message: "Sumber tidak dikenal." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Pilih file dulu." };
  try {
    const saved = saveUpload(source, file.name, Buffer.from(await file.arrayBuffer()));
    refresh();
    return { ok: true, message: `${saved.fileName} sekarang dipakai untuk ${SOURCE_FILES[source].label}. Jalankan import untuk memuatnya.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function discardUploadAction(source: FileSource): Promise<ActionResult> {
  // Server actions are public endpoints: the bound argument can be anything a client sends.
  if (!isFileSource(source)) return { ok: false, message: "Sumber tidak dikenal." };
  discardUpload(source);
  refresh();
  return { ok: true, message: `Kembali ke file contoh ${SOURCE_FILES[source].bundled}. Jalankan import untuk memuatnya lagi.` };
}

/** Assigns a typed name to a project, or marks it as checked and not a project ("skip"). */
export async function linkLabelAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const label = normalizeLabel(String(form.get("label") ?? ""));
  const choice = String(form.get("projectCode") ?? "");
  const db = getDb();
  if (!label) return { ok: false, message: "Nama kosong tidak bisa dicocokkan. Isi nama proyeknya di sumber datanya." };
  // The row leaves the list once saved, so the confirmation travels to the page in the URL.
  const done = (message: string) => { refresh(); redirect(`/review?selesai=${encodeURIComponent(message)}`); };
  if (choice === "skip") {
    markLabelReviewed(db, label);
    done(`"${label}" ditandai sudah dicek. Transaksinya tetap tanpa proyek dan tidak muncul di daftar ini lagi.`);
  }
  const { projects } = loadReferenceData(db);
  if (!projects.some((p) => p.code === choice)) return { ok: false, message: "Pilih proyek dulu." };
  addUserAlias(db, label, choice);
  const { resolver } = loadReferenceData(db);
  const moved = relinkRecords(db, resolver);
  const alerts = await runConfiguredAlerts(db);
  const sent = alerts.sent.map((a) => " Budget alert terkirim: " + alertLine(a) + ".").join("");
  done(`Tersimpan. ${moved} transaksi "${label}" pindah ke ${choice}, dan import berikutnya ikut memakai pilihan ini.${sent}`);
  return { ok: true, message: "" };
}

export async function checkAlertsAction(): Promise<ActionResult> {
  const db = getDb();
  const r = await runConfiguredAlerts(db);
  refresh();
  if (r.sent.length === 0 && r.failed.length === 0) return { ok: true, message: "Tidak ada yang baru. Semua batas yang terlewati sudah diberitahukan." };
  return {
    ok: r.failed.length === 0,
    message: `${r.sent.length} budget alert terkirim${r.failed.length ? `, ${r.failed.length} gagal` : ""}.`,
    details: [...r.sent.map(alertLine), ...r.failed.map((f) => `${f.alert.projectCode}: ${f.error}`)],
  };
}

export async function resetAlertsAction(): Promise<ActionResult> {
  const db = getDb();
  const n = resetAlerts(db);
  refresh();
  return { ok: true, message: `${n} catatan alert dihapus. Pengecekan berikutnya mengirim semuanya lagi.` };
}

/** Saves the webhook URL from the Budget alert page, after checking it looks like a Slack, Discord or https URL. */
export async function saveWebhookAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const url = String(form.get("url") ?? "").trim();
  const problem = validateWebhookUrl(url);
  if (problem) return { ok: false, message: problem };
  setSetting(getDb(), WEBHOOK_KEY, url);
  refresh();
  return { ok: true, message: `Tersimpan. Budget alert sekarang dikirim ke ${PROVIDER_LABEL[detectProvider(url)]} (${maskWebhookUrl(url)}). Klik "Kirim pesan uji" untuk memastikan pesannya sampai.` };
}

export async function testWebhookAction(): Promise<ActionResult> {
  const hook = configuredWebhook(getDb());
  if (!hook) return { ok: false, message: "Belum ada URL webhook. Simpan URL Slack atau Discord dulu." };
  const provider = detectProvider(hook.url);
  try {
    await postWebhook(hook.url, buildPayload(provider, TEST_MESSAGE, null));
    return { ok: true, message: `Pesan uji terkirim ke ${PROVIDER_LABEL[provider]}. Cek channel-nya.` };
  } catch (err) {
    return { ok: false, message: `Pesan uji gagal. ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function clearWebhookAction(): Promise<ActionResult> {
  const db = getDb();
  deleteSetting(db, WEBHOOK_KEY);
  refresh();
  const fallback = configuredWebhook(db);
  return { ok: true, message: fallback ? `URL dari halaman ini dihapus. Sekarang memakai webhook dari .env (${maskWebhookUrl(fallback.url)}).` : "URL dihapus. Budget alert hanya dicatat di aplikasi sampai URL baru disimpan." };
}
