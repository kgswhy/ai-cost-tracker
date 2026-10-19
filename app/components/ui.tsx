import Link from "next/link";
import { STATUS_FILL, STATUS_TEXT, type Status } from "../lib/format";

/** Page heading: an optional step line ("Langkah 2 dari 4"), the title, a lede, and actions on the right. */
export function PageHeader({ step, title, lede, actions }: { step?: string; title: string; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-5">
      <div className="max-w-3xl">
        {step ? <p className="mb-1 text-[13px] text-ink-muted">{step}</p> : null}
        <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
        {lede ? <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

/** A ledger section: a heading, a muted hint, content. Separated by space and hairlines, not boxes. */
export function Section({ title, hint, aside, children, id, className = "" }: {
  title: string; hint?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; id?: string; className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={`pt-7 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id ? `${id}-h` : undefined} className="text-lg font-semibold">{title}</h2>
        {aside ? <div className="text-[13px] text-ink-muted">{aside}</div> : null}
      </div>
      {hint ? <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One figure in a row of totals. */
export function Figure({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: "over" }) {
  return (
    <div className="min-w-[150px] flex-1 sm:border-l sm:border-line-soft sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap font-mono text-[28px] font-medium leading-tight ${tone === "over" ? "text-over" : ""}`}>{value}</p>
      {note ? <p className="mt-1 text-[13px]">{note}</p> : null}
    </div>
  );
}

/** The budget bar: a fill in the status colour and a hairline marker at the warning threshold. */
export function BudgetBar({ pctUsed, status, warnAt = 80, thick }: { pctUsed: number; status: Status; warnAt?: number; thick?: boolean }) {
  return (
    <span className={`relative block flex-1 bg-line-soft ${thick ? "h-2" : "h-1.5"}`} role="img" aria-label={`${pctUsed.toFixed(1)}% budget terpakai`}>
      <span className={`absolute inset-y-0 left-0 ${STATUS_FILL[status.cls]}`} style={{ width: `${Math.min(100, Math.max(0, pctUsed))}%` }} />
      <span className="absolute -inset-y-1 w-px bg-[#888888]" style={{ left: `${warnAt}%` }} />
    </span>
  );
}

export function StatusText({ status }: { status: Status }) {
  return <span className={`text-[13px] font-semibold ${status.cls === "ok" ? "text-ink" : STATUS_TEXT[status.cls]}`}>{status.label}</span>;
}

/** A small rectangular tag for a state word. */
export function Tag({ tone, children }: { tone: "over" | "warn" | "neutral" | "ok"; children: React.ReactNode }) {
  const cls = { over: "bg-over-bg text-over", warn: "bg-warn-bg text-warn", neutral: "bg-line-soft text-ink", ok: "bg-ok-bg text-accent" }[tone];
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** A hairline table that scrolls inside its own box on narrow screens. */
export function Table({ children, label, minWidth = 720 }: { children: React.ReactNode; label?: string; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table
        aria-label={label}
        style={{ minWidth }}
        className="w-full border-collapse text-sm [&_th]:border-b [&_th]:border-ink [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-ink-muted [&_th:first-child]:pl-0 [&_td]:border-b [&_td]:border-line-soft [&_td]:px-2 [&_td]:py-3 [&_td]:align-top [&_td:first-child]:pl-0"
      >
        {children}
      </table>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-line-soft py-6 text-center text-sm text-ink-muted">{children}</p>;
}

/** A yellow "check this first" note. */
export function CheckNote({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role="note" className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-check-line bg-check-bg px-3.5 py-3">
      <div className="min-w-0 flex-[1_1_420px] text-sm leading-relaxed">{children}</div>
      {action}
    </div>
  );
}

export const btn = "inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-4 text-sm font-semibold text-white no-underline hover:bg-[#333333] hover:text-white disabled:cursor-progress disabled:opacity-60";
export const btnSecondary = "inline-flex min-h-11 items-center justify-center border border-ink bg-card px-4 text-sm font-medium text-ink no-underline hover:bg-line-soft hover:text-ink disabled:opacity-60";
export const btnSmall = "inline-flex min-h-10 items-center border border-ink bg-card px-3.5 text-[13px] font-semibold text-ink no-underline hover:bg-line-soft hover:text-ink";

export function ButtonLink({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Link href={href} className={secondary ? btnSecondary : btn}>{children}</Link>;
}
