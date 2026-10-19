import { usdCentsToIdr } from "../normalize/money";
import { parseIsoUtc } from "../normalize/time";
import type { UsageRecord } from "../types";
import type { ImportContext, ImportOutput, Importer } from "./types";

interface VendorCRecord {
  id: string;
  created_at: string;
  project: string;
  service: string;
  amount_usd_cents: number;
}

interface VendorCPage {
  data: VendorCRecord[];
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export interface VendorCClientOptions {
  baseUrl: string;
  apiKey: string;
  perPage?: number;
  maxAttempts?: number;
  /** Base delay for 5xx/network backoff, ms. 429 uses Retry-After instead. */
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Walks every page of GET /v1/usage. The API rate-limits (429 + Retry-After)
 * and throws intermittent 5xx; both are retried per page with a bounded
 * number of attempts. 4xx other than 429 are configuration errors and fail fast.
 */
export async function fetchAllVendorCUsage(opts: VendorCClientOptions, log: (m: string) => void = () => {}): Promise<VendorCRecord[]> {
  const perPage = Math.min(opts.perPage ?? 100, 100);
  const maxAttempts = opts.maxAttempts ?? 8;
  const baseDelay = opts.baseDelayMs ?? 500;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  if (!opts.apiKey) throw new Error("VENDOR_C_API_KEY is not set");

  const all: VendorCRecord[] = [];
  let page = 1;
  for (;;) {
    const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/usage?page=${page}&per_page=${perPage}`;
    let body: VendorCPage | undefined;
    for (let attempt = 1; attempt <= maxAttempts && !body; attempt++) {
      let res: Response;
      try {
        res = await fetchImpl(url, { headers: { Authorization: `Bearer ${opts.apiKey}` } });
      } catch (err) {
        if (attempt === maxAttempts) throw new Error(`Vendor C unreachable at ${url}: ${(err as Error).message}`);
        const wait = baseDelay * 2 ** (attempt - 1);
        log(`Vendor C page ${page}: network error, retry ${attempt}/${maxAttempts} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (res.status === 200) { body = (await res.json()) as VendorCPage; break; }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 1;
        log(`Vendor C page ${page}: rate limited, waiting ${retryAfter}s (attempt ${attempt}/${maxAttempts})`);
        if (attempt === maxAttempts) throw new Error(`Vendor C page ${page}: still rate limited after ${maxAttempts} attempts`);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (res.status >= 500) {
        const wait = baseDelay * 2 ** (attempt - 1);
        log(`Vendor C page ${page}: HTTP ${res.status}, retry ${attempt}/${maxAttempts} in ${wait}ms`);
        if (attempt === maxAttempts) throw new Error(`Vendor C page ${page}: HTTP ${res.status} after ${maxAttempts} attempts`);
        await sleep(wait);
        continue;
      }
      throw new Error(`Vendor C page ${page}: HTTP ${res.status} ${await res.text()}`);
    }
    if (!body) throw new Error(`Vendor C page ${page}: gave up`);
    all.push(...body.data);
    if (!body.has_more || body.data.length === 0) break;
    page++;
  }
  return all;
}

export function vendorCImporter(opts: VendorCClientOptions): Importer {
  return {
    source: "vendor_c",
    label: "Vendor C",
    async run(ctx: ImportContext): Promise<ImportOutput> {
      const raw = await fetchAllVendorCUsage(opts, ctx.warn);
      const records: UsageRecord[] = [];
      const seen = new Set<string>();
      let skipped = 0;
      for (const r of raw) {
        if (seen.has(r.id)) { ctx.warn(`Vendor C: id ${r.id} returned twice (page boundary shift?) - kept once`); skipped++; continue; }
        seen.add(r.id);
        records.push({
          source: "vendor_c",
          externalId: r.id,
          vendor: "Vendor C",
          item: r.service,
          projectLabel: r.project,
          projectCode: ctx.projects.resolve(r.project),
          occurredAtUtc: parseIsoUtc(r.created_at),
          originalAmount: r.amount_usd_cents / 100,
          originalCurrency: "USD",
          amountIdr: usdCentsToIdr(r.amount_usd_cents, ctx.rates),
        });
      }
      return { records, fetched: raw.length, skipped };
    },
  };
}
