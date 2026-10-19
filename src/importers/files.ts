import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

export type FileSource = "vendor_a" | "vendor_b" | "manual_ops";

export const SOURCE_FILES: Record<FileSource, { bundled: string; accept: string[]; label: string }> = {
  vendor_a: { bundled: "vendor_a.csv", accept: [".csv"], label: "Export Vendor A (CSV)" },
  vendor_b: { bundled: "vendor_b.csv", accept: [".csv"], label: "Export Vendor B (CSV)" },
  manual_ops: { bundled: "manual_ops.xlsx", accept: [".xlsx"], label: "Spreadsheet manual (XLSX)" },
};

/** True only for the three own keys, so "toString" or "constructor" from a crafted request is rejected. */
export function isFileSource(value: unknown): value is FileSource {
  return typeof value === "string" && Object.hasOwn(SOURCE_FILES, value);
}

// Uploads and sample files are runtime data, not code: the ignore comment stops
// Turbopack from tracing the whole project into the server output.
const uploadPath = (name: string) => path.join(/*turbopackIgnore: true*/ config.uploadsDir, name);
const samplePath = (name: string) => path.join(/*turbopackIgnore: true*/ config.dataDir, name);

export interface ResolvedFile {
  path: string;
  origin: "uploaded" | "bundled";
  fileName: string;
  updatedAt: string; // ISO
}

/**
 * The file an importer reads: the latest upload from the dashboard if there is
 * one, otherwise the copy shipped in data/. Uploads live in data/uploads and
 * are not committed.
 */
export function resolveSourceFile(source: FileSource): ResolvedFile {
  const meta = SOURCE_FILES[source];
  const uploaded = uploadPath(meta.bundled);
  if (fs.existsSync(uploaded)) {
    return { path: uploaded, origin: "uploaded", fileName: readUploadName(source) ?? meta.bundled, updatedAt: fs.statSync(uploaded).mtime.toISOString() };
  }
  const bundled = samplePath(meta.bundled);
  return { path: bundled, origin: "bundled", fileName: meta.bundled, updatedAt: fs.statSync(bundled).mtime.toISOString() };
}

export function saveUpload(source: FileSource, originalName: string, bytes: Buffer): ResolvedFile {
  if (!isFileSource(source)) throw new Error(`Unknown source "${String(source)}"`);
  const meta = SOURCE_FILES[source];
  const ext = path.extname(originalName).toLowerCase();
  if (!meta.accept.includes(ext)) throw new Error(`${meta.label} harus file ${meta.accept.join(" atau ")}, sedangkan yang dipilih "${originalName}". Pilih file export yang benar.`);
  if (bytes.length === 0) throw new Error(`${originalName} kosong. Pilih file lain.`);
  fs.mkdirSync(uploadPath(""), { recursive: true });
  const target = uploadPath(meta.bundled);
  fs.writeFileSync(target, bytes);
  fs.writeFileSync(uploadPath(meta.bundled + ".name"), originalName);
  return resolveSourceFile(source);
}

export function discardUpload(source: FileSource): void {
  if (!isFileSource(source)) throw new Error(`Unknown source "${String(source)}"`);
  const name = SOURCE_FILES[source].bundled;
  for (const f of [uploadPath(name), uploadPath(name + ".name")]) if (fs.existsSync(f)) fs.unlinkSync(f);
}

function readUploadName(source: FileSource): string | null {
  const f = uploadPath(SOURCE_FILES[source].bundled + ".name");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : null;
}
