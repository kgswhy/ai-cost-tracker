"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pctRound, SOURCE_LABEL, statusOf, STATUS_TEXT, wib } from "../lib/format";

export interface ShellData {
  thresholds: number[];
  projects: { code: string; client: string; pctUsed: number }[];
  namesWaiting: number;
  outliers: number;
  alertsPending: number;
  lastImport: { at: string; failed: string[]; inserted: number; unchanged: number; updated: number } | null;
}

/** Left sidebar on desktop; a top bar with a Menu button below lg. The weekly routine is the navigation. */
export function Sidebar({ data }: { data: ShellData }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const steps = [
    { n: 1, href: "/import", label: "Import data", note: "Vendor A, B, C dan spreadsheet manual", count: 0 },
    { n: 2, href: "/review", label: "Nama tak dikenal", note: "Transaksi tanpa proyek", count: data.namesWaiting },
    { n: 3, href: "/charges", label: "Tagihan janggal", note: "Cocokkan dengan invoice", count: data.outliers },
    { n: 4, href: "/alerts", label: "Budget alert", note: "Peringatan di 80% budget", count: data.alertsPending },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const li = data.lastImport;

  return (
    <aside aria-label="Navigasi" className="border-b border-line bg-side lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6 lg:pt-6 lg:pb-0">
        <Link href="/" className="no-underline">
          <span className="block text-[15px] font-bold tracking-tight text-ink">AI Production Cost Tracker</span>
          <span className="block text-xs text-ink-muted">Spend tool AI per proyek, dalam rupiah</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="sidebar-nav"
          className="inline-flex min-h-11 items-center border border-ink bg-card px-4 text-sm font-semibold lg:hidden"
        >
          {open ? "Tutup" : "Menu"}
        </button>
      </div>

      <nav
        id="sidebar-nav"
        aria-label="Menu utama"
        // On a phone the menu closes once a link is chosen.
        onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
        className={`${open ? "flex" : "hidden"} flex-col gap-6 px-2 pb-4 pt-4 text-sm lg:flex lg:px-4 lg:pt-7`}>
        <Link
          href="/"
          aria-current={active("/") ? "page" : undefined}
          className={`flex min-h-11 items-center px-2 font-semibold no-underline ${active("/") ? "bg-ink text-white hover:text-white" : "text-ink hover:text-ink"}`}
        >
          Dashboard
        </Link>

        <div>
          <p className="mb-1.5 px-2 text-xs font-semibold text-ink-muted">Rutinitas mingguan, urut dari atas</p>
          {steps.map((s) => {
            const on = active(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-line-soft px-2 py-2.5 no-underline ${on ? "bg-ink text-white hover:text-white" : "text-ink hover:text-ink hover:bg-line-soft"}`}
              >
                <span className="font-mono text-xs opacity-70">{s.n}</span>
                <span>
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-xs opacity-75">{s.note}</span>
                </span>
                {s.count > 0 ? (
                  <span className={`px-1.5 py-px font-mono text-xs font-medium ${on ? "bg-white text-ink" : "bg-ink text-white"}`} aria-label={`${s.count} menunggu`}>{s.count}</span>
                ) : <span />}
              </Link>
            );
          })}
        </div>

        <div>
          <p className="mb-1.5 px-2 text-xs font-semibold text-ink-muted">Proyek</p>
          {data.projects.map((p) => {
            const st = statusOf(p.pctUsed, data.thresholds);
            const on = path === `/projects/${p.code}`;
            return (
              <Link
                key={p.code}
                href={`/projects/${p.code}`}
                aria-current={on ? "page" : undefined}
                className={`flex justify-between gap-2 border-t border-line-soft px-2 py-2 no-underline ${on ? "bg-line-soft" : ""} text-ink hover:text-ink hover:bg-line-soft`}
              >
                <span><span className="font-mono text-[13px] font-medium">{p.code}</span> <span className="text-[13px] text-ink-muted">{p.client}</span></span>
                <span className={`font-mono text-[13px] font-medium ${st.cls === "ok" ? "text-ink-muted" : STATUS_TEXT[st.cls]}`}>{pctRound(p.pctUsed)}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto border-t border-line px-2 pt-3 text-xs leading-relaxed text-ink-muted">
          {li ? (
            <>
              <p className="font-medium text-ink">Import terakhir {wib(li.at)}</p>
              <p>
                {li.failed.length
                  ? <span className="text-over">{li.failed.map((s) => SOURCE_LABEL[s] ?? s).join(", ")} gagal. </span>
                  : "Vendor A, Vendor B, Vendor C API dan spreadsheet manual berhasil. "}
                {li.inserted} transaksi baru, {li.updated ? `${li.updated} diperbarui, ` : ""}{li.unchanged} tidak berubah, jadi tidak ada yang terhitung dua kali.
              </p>
            </>
          ) : <p>Belum pernah import.</p>}
          <a href="/export" className="mt-2 inline-block text-[13px]">Unduh semua transaksi (CSV)</a>
        </div>
      </nav>
    </aside>
  );
}
