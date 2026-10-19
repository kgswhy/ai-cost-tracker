import Link from "next/link";
import type { Status } from "../lib/format";

export function Section({ title, hint, children, id }: { title: string; hint?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-lg border border-line bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PageTitle({ title, lede, action }: { title: string; lede?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lede ? <p className="mt-1 max-w-3xl text-sm text-ink-muted">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({ status }: { status: Status }) {
  const cls = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", over: "bg-over-bg text-over" }[status.cls];
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{status.label}</span>;
}

/** The budget bar: the one visual that repeats on every page. Colour is the state, nothing else. */
export function BudgetBar({ pctUsed, status }: { pctUsed: number; status: Status }) {
  const fill = { ok: "bg-ok", warn: "bg-warn", over: "bg-over" }[status.cls];
  return (
    <div className="relative h-2.5 w-full min-w-36 overflow-hidden rounded bg-line" role="img" aria-label={`${pctUsed.toFixed(1)}% of budget used`}>
      <div className={`absolute inset-y-0 left-0 rounded ${fill}`} style={{ width: `${Math.min(100, Math.max(0, pctUsed)).toFixed(1)}%` }} />
    </div>
  );
}

export function Table({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-sm [&_th]:border-b [&_th]:border-line [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-[13px] [&_th]:font-semibold [&_th]:text-ink-muted [&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-middle [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-paper px-4 py-6 text-center text-sm text-ink-muted">{children}</p>;
}

export function Notice({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className={`rounded-md border-l-4 px-4 py-3 text-sm ${ok ? "border-action bg-blue-50" : "border-over bg-over-bg"}`}>
      {children}
    </div>
  );
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink hover:opacity-90">
      {children}
    </Link>
  );
}

export const btn = "inline-flex min-h-11 items-center justify-center rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink hover:opacity-90 disabled:cursor-progress disabled:opacity-60";
export const btnSecondary = "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60";
