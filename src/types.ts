/** One spend line in the shape every importer produces. */
export interface UsageRecord {
  source: Source;
  /** Stable per source; (source, externalId) is the idempotency key. */
  externalId: string;
  vendor: string;
  item: string;
  /** The label as typed in the vendor tool, kept for the unassigned list. */
  projectLabel: string;
  /** null when the label matched no code, name or alias. */
  projectCode: string | null;
  occurredAtUtc: Date;
  originalAmount: number;
  originalCurrency: "CREDIT" | "USD" | "IDR";
  /** Negative for refunds. */
  amountIdr: number;
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
