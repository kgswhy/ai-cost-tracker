"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The order is the weekly flow: bring data in, fix what did not link, read the numbers, see what was sent.
const ITEMS = [
  { href: "/import", label: "Import" },
  { href: "/review", label: "Review labels" },
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">AI Production Cost Tracker</Link>
        <nav aria-label="Main" className="flex flex-wrap gap-1">
          {ITEMS.map((it) => {
            const active = it.href === "/" ? path === "/" || path.startsWith("/projects") : path.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium min-h-11 inline-flex items-center ${active ? "bg-paper text-ink" : "text-ink-muted hover:text-ink"}`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
