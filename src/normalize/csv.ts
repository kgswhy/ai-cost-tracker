/**
 * Minimal RFC 4180 CSV parser. Handles quoted fields with embedded commas
 * (Vendor B writes "$1,036.15") and CRLF line endings. Returns rows as objects
 * keyed by the header row.
 */
export function parseCsv(text: string): Record<string, string>[] {
  return parseCsvTable(text).rows;
}

/**
 * Parses a vendor export and refuses it when a column the importer reads is
 * missing. A wrong or renamed file then fails up front with a message the ops
 * team can act on, instead of on its first row with an empty value.
 */
export function parseExport(text: string, source: string, required: string[]): Record<string, string>[] {
  const { columns, rows } = parseCsvTable(text);
  const missing = required.filter((c) => !columns.includes(c));
  if (missing.length) {
    throw new Error(
      `File ${source} tidak punya kolom ${missing.join(", ")}. Pastikan yang diunggah adalah export ${source} yang benar. ` +
      `Kolom yang dibutuhkan: ${required.join(", ")}.`,
    );
  }
  return rows;
}

function parseCsvTable(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (!header) return { columns: [], rows: [] };
  const columns = header.map((h) => h.trim());
  return { columns, rows: body.map((r) => Object.fromEntries(columns.map((h, i) => [h, (r[i] ?? "").trim()]))) };
}
