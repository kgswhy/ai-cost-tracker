import type { NextRequest } from "next/server";
import { getDb } from "@/src/db/connection";
import { allRecords } from "@/src/db/queries";
import { recordsToCsv } from "@/src/analysis/exportCsv";

export const dynamic = "force-dynamic";

/** GET /export?project=KMD-02 (optional) downloads the normalised records as CSV. */
export function GET(req: NextRequest): Response {
  const code = req.nextUrl.searchParams.get("project")?.toUpperCase() || undefined;
  const rows = allRecords(getDb(), code);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = code ? `ai-spend-${code}-${stamp}.csv` : `ai-spend-all-${stamp}.csv`;
  return new Response(recordsToCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
