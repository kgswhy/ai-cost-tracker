import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

export type FileSource = "vendor_a" | "vendor_b" | "manual_ops";

export const SOURCE_FILES: Record<FileSource, { bundled: string; accept: string[]; label: string }> = {
  vendor_a: { bundled: "vendor_a.csv", accept: [".csv"], label: "Export Vendor A (CSV)" },
  vendor_b: { bundled: "vendor_b.csv", accept: [".csv"], label: "Export Vendor B (CSV)" },
  manual_ops: { bundled: "manual_ops.xlsx", accept: [".xlsx"], label: "Spreadsheet manual (XLSX)" },
};

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
  const uploaded = path.join(config.uploadsDir, meta.bundled);
  if (fs.existsSync(uploaded)) {
    return { path: uploaded, origin: "uploaded", fileName: readUploadName(source) ?? meta.bundled, updatedAt: fs.statSync(uploaded).mtime.toISOString() };
  }
  const bundled = path.join(config.dataDir, meta.bundled);
  return { path: bundled, origin: "bundled", fileName: meta.bundled, updatedAt: fs.statSync(bundled).mtime.toISOString() };
}

export function saveUpload(source: FileSource, originalName: string, bytes: Buffer): ResolvedFile {
  const meta = SOURCE_FILES[source];
  const ext = path.extname(originalName).toLowerCase();
  if (!meta.accept.includes(ext)) throw new Error(`${meta.label} must be ${meta.accept.join(" or ")}, got "${originalName}"`);
  if (bytes.length === 0) throw new Error(`${originalName} is empty`);
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const target = path.join(config.uploadsDir, meta.bundled);
  fs.writeFileSync(target, bytes);
  fs.writeFileSync(target + ".name", originalName);
  return resolveSourceFile(source);
}

export function discardUpload(source: FileSource): void {
  const target = path.join(config.uploadsDir, SOURCE_FILES[source].bundled);
  for (const f of [target, target + ".name"]) if (fs.existsSync(f)) fs.unlinkSync(f);
}

function readUploadName(source: FileSource): string | null {
  const f = path.join(config.uploadsDir, SOURCE_FILES[source].bundled + ".name");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : null;
}
