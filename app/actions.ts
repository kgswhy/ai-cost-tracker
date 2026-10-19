"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/src/db/connection";
import { addUserAlias, relinkRecords } from "@/src/db/index";
import { loadReferenceData, runImport, type SourceSummary } from "@/src/importers/index";
import { discardUpload, saveUpload, SOURCE_FILES, type FileSource } from "@/src/importers/files";
import { runConfiguredAlerts } from "@/src/alerts/run";
import { formatAlertMessage, resetAlerts } from "@/src/alerts/index";
import { normalizeLabel } from "@/src/normalize/project";

export interface ActionResult {
  ok: boolean;
  message: string;
  details?: string[];
  summaries?: SourceSummary[];
}

function revalidateAll() {
  for (const p of ["/", "/import", "/review", "/alerts"]) revalidatePath(p);
  revalidatePath("/projects/[code]", "page");
}

export async function runImportAction(): Promise<ActionResult> {
  const db = getDb();
  const summaries = await runImport({ db });
  const alerts = await runConfiguredAlerts(db);
  revalidateAll();
  const failed = summaries.filter((s) => s.status === "failed");
  const details = alerts.sent.map((a) => "Alert sent: " + formatAlertMessage(a).replace(/\n/g, ", "));
  for (const f of alerts.failed) details.push(`Alert for ${f.alert.projectCode} failed: ${f.error}`);
  return {
    ok: failed.length === 0,
    message: failed.length ? `${failed.length} source(s) failed; the others imported.` : "Import finished. Nothing is counted twice: unchanged rows stay as they are.",
    details,
    summaries,
  };
}

export async function uploadAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const source = String(form.get("source")) as FileSource;
  const file = form.get("file");
  if (!(source in SOURCE_FILES)) return { ok: false, message: "Unknown source." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file first." };
  try {
    const saved = saveUpload(source, file.name, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/import");
    return { ok: true, message: `${saved.fileName} is now the ${SOURCE_FILES[source].label}. Run the import to load it.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function discardUploadAction(source: FileSource): Promise<ActionResult> {
  discardUpload(source);
  revalidatePath("/import");
  return { ok: true, message: `Back to the bundled ${SOURCE_FILES[source].bundled}. Run the import to reload it.` };
}

export async function linkLabelAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const label = normalizeLabel(String(form.get("label") ?? ""));
  const projectCode = String(form.get("projectCode") ?? "");
  const db = getDb();
  const { projects } = loadReferenceData(db);
  if (!label) return { ok: false, message: "Blank labels cannot be linked; fix them at the source." };
  if (!projects.some((p) => p.code === projectCode)) return { ok: false, message: "Pick a project." };
  addUserAlias(db, label, projectCode);
  const { resolver } = loadReferenceData(db);
  const moved = relinkRecords(db, resolver);
  const alerts = await runConfiguredAlerts(db);
  // Every page except this one: the row stays on screen with its confirmation until the next visit.
  for (const p of ["/", "/import", "/alerts"]) revalidatePath(p);
  revalidatePath("/projects/[code]", "page");
  const details = alerts.sent.map((a) => "Alert sent: " + formatAlertMessage(a).replace(/\n/g, ", "));
  return { ok: true, message: `"${label}" now means ${projectCode}. ${moved} record(s) moved. It leaves this list on the next visit.`, details };
}

export async function checkAlertsAction(): Promise<ActionResult> {
  const db = getDb();
  const r = await runConfiguredAlerts(db);
  revalidatePath("/alerts");
  revalidatePath("/");
  if (r.sent.length === 0 && r.failed.length === 0) return { ok: true, message: "Nothing new to send. Every crossed threshold has already been announced." };
  return {
    ok: r.failed.length === 0,
    message: `${r.sent.length} alert(s) sent${r.failed.length ? `, ${r.failed.length} failed` : ""}.`,
    details: [...r.sent.map((a) => formatAlertMessage(a).replace(/\n/g, ", ")), ...r.failed.map((f) => `${f.alert.projectCode}: ${f.error}`)],
  };
}

export async function resetAlertsAction(): Promise<ActionResult> {
  const db = getDb();
  const n = resetAlerts(db);
  revalidatePath("/alerts");
  return { ok: true, message: `Forgot ${n} sent alert(s). The next check sends them again.` };
}
