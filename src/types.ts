/** One normalized spend line, regardless of which vendor it came from. */
export interface UsageRecord {
  /** Which import source produced it: vendor_a | vendor_b | vendor_c | manual_ops */
  source: Source;
  /** Vendor-side identifier. Stable per source; used for idempotent upserts. */
  externalId: string;
  /** Display name of the tool / vendor for the breakdown (e.g. "Vendor A", "Stock Music"). */
  vendor: string;
  /** What was bought: model, product, service, or free-text description. */
  item: string;
  /** Free-text project label as the user typed it in the vendor tool. */
  projectLabel: string;
  /** Canonical project code, or null when the label matched nothing. */
  projectCode: string | null;
  /** Event time in UTC. */
  occurredAtUtc: Date;
  /** Original amount and currency before conversion. */
  originalAmount: number;
  originalCurrency: "CREDIT" | "USD" | "IDR";
  /** Amount in IDR after conversion. Negative for refunds. */
  amountIdr: number;
  /** For refunds: the external id of the charge being reversed. */
  refundOf?: string | null;
}

export type Source = "vendor_a" | "vendor_b" | "vendor_c" | "manual_ops";

export interface Project {
  code: string;
  name: string;
  client: string;
  budgetIdr: number;
}

export interface Rates {
  credit_to_idr: number;
  usd_to_idr: number;
}
