import type { AlertRow, ImportRunRow, ProjectSpend, UnassignedRecord, VendorByProject, VendorSpend, WeeklySpend } from "../db/queries.js";
import type { SourceSummary } from "../importers/index.js";
import { formatIdr } from "../normalize/money.js";

export interface DashboardData {
  generatedAt: string;
  totals: { spendIdr: number; budgetIdr: number; recordCount: number; unassignedIdr: number };
  projects: ProjectSpend[];
  vendors: VendorSpend[];
  vendorByProject: VendorByProject[];
  weekly: WeeklySpend[];
  unassigned: UnassignedRecord[];
  importRuns: ImportRunRow[];
  alerts: AlertRow[];
  thresholds: number[];
  lastImport?: { at: string; summaries: SourceSummary[]; alertsSent: number } | null;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const idr = (n: number) => formatIdr(n);
const pct = (n: number) => `${n.toFixed(1)}%`;
const SOURCE_LABEL: Record<string, string> = { vendor_a: "Vendor A CSV", vendor_b: "Vendor B CSV", vendor_c: "Vendor C API", manual_ops: "Manual ops sheet" };

function statusOf(p: ProjectSpend, thresholds: number[]) {
  const warn = thresholds.find((t) => t < 100) ?? 80;
  if (p.pctUsed >= 100) return { cls: "over", label: "Over budget" };
  if (p.pctUsed >= warn) return { cls: "warn", label: `Above ${warn}%` };
  return { cls: "ok", label: "On track" };
}

function wibNow(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return d.toISOString().slice(0, 16).replace("T", " ") + " WIB";
}

function weekLabel(monday: string): string {
  const d = new Date(monday + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function renderDashboard(d: DashboardData): string {
  const projectCodes = d.projects.map((p) => p.code);
  const vendorNames = d.vendors.map((v) => v.vendor);
  const weeks = [...new Set(d.weekly.map((w) => w.weekStart))].sort();
  const seriesKeys = [...projectCodes, null];

  const vendorStack = {
    labels: [...projectCodes, "Unassigned"],
    datasets: vendorNames.map((vendor) => ({
      label: vendor,
      data: seriesKeys.map((code) => d.vendorByProject.find((x) => x.projectCode === code && x.vendor === vendor)?.spendIdr ?? 0),
    })),
  };
  const weeklyStack = {
    labels: weeks.map(weekLabel),
    datasets: seriesKeys.map((code) => ({
      label: code ?? "Unassigned",
      data: weeks.map((w) => d.weekly.find((x) => x.weekStart === w && x.projectCode === code)?.spendIdr ?? 0),
    })),
  };
  const totalPct = d.totals.budgetIdr ? (d.totals.spendIdr / d.totals.budgetIdr) * 100 : 0;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Production Cost Tracker</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#1a1d23; --muted:#6b7280; --line:#e5e7eb; --ok:#16a34a; --warn:#d97706; --over:#dc2626; --accent:#2563eb; }
  * { box-sizing: border-box; }
  body { margin:0; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:var(--ink); background:var(--bg); }
  header { background:var(--card); border-bottom:1px solid var(--line); padding:18px 24px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; }
  header h1 { font-size:20px; margin:0; }
  header .sub { color:var(--muted); font-size:13px; }
  main { max-width:1200px; margin:0 auto; padding:20px 16px 48px; display:grid; gap:20px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; }
  .card, section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 18px; }
  .card .k { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .card .v { font-size:22px; font-weight:600; margin-top:4px; }
  section h2 { font-size:16px; margin:0 0 12px; }
  section p.hint { color:var(--muted); font-size:13px; margin:-6px 0 12px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:middle; white-space:nowrap; }
  th { color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; }
  .bar { position:relative; height:10px; background:#eef0f3; border-radius:5px; min-width:140px; overflow:hidden; }
  .bar > i { position:absolute; inset:0 auto 0 0; border-radius:5px; background:var(--ok); }
  .bar.warn > i { background:var(--warn); } .bar.over > i { background:var(--over); }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; }
  .badge.ok { background:#dcfce7; color:#166534; } .badge.warn { background:#fef3c7; color:#92400e; } .badge.over { background:#fee2e2; color:#991b1b; }
  .muted { color:var(--muted); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media (max-width: 900px) { .grid2 { grid-template-columns:1fr; } }
  .chart { position:relative; height:320px; }
  form.inline { display:inline; }
  button { font:inherit; background:var(--accent); color:#fff; border:0; border-radius:8px; padding:9px 14px; cursor:pointer; font-weight:600; }
  button:disabled { opacity:.6; cursor:progress; }
  .flash { border-left:4px solid var(--accent); background:#eff6ff; padding:10px 14px; border-radius:8px; font-size:14px; }
  .flash.err { border-color:var(--over); background:#fef2f2; }
  .tablewrap { overflow-x:auto; }
  code { background:#f3f4f6; padding:1px 5px; border-radius:4px; font-size:13px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>AI Production Cost Tracker</h1>
    <div class="sub">All amounts in IDR · times in WIB (UTC+7) · refreshed ${esc(wibNow(d.generatedAt))}</div>
  </div>
  <form class="inline" method="post" action="/import" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Importing… (can take ~10s)'">
    <button type="submit">Run import now</button>
  </form>
</header>
<main>
${d.lastImport ? renderFlash(d.lastImport) : ""}

<div class="cards">
  <div class="card"><div class="k">Total spend</div><div class="v">${idr(d.totals.spendIdr)}</div></div>
  <div class="card"><div class="k">Total budget</div><div class="v">${idr(d.totals.budgetIdr)}</div><div class="muted">${pct(totalPct)} used overall</div></div>
  <div class="card"><div class="k">Records</div><div class="v">${d.totals.recordCount.toLocaleString("id-ID")}</div></div>
  <div class="card"><div class="k">Not linked to a project</div><div class="v">${idr(d.totals.unassignedIdr)}</div><div class="muted">${d.unassigned.length} record(s), see below</div></div>
</div>

<section>
  <h2>Spend vs budget per project</h2>
  <p class="hint">Warning at ${d.thresholds.filter((t) => t < 100).join("% and ")}%, over budget at 100%. Alerts are sent to the configured webhook when a project crosses a threshold.</p>
  <div class="tablewrap"><table>
    <tr><th>Project</th><th>Client</th><th class="num">Spend</th><th class="num">Budget</th><th class="num">Used</th><th style="width:30%">Progress</th><th>Status</th></tr>
    ${d.projects.map((p) => { const s = statusOf(p, d.thresholds); return `
    <tr>
      <td><strong>${esc(p.code)}</strong><br><span class="muted">${esc(p.name)}</span></td>
      <td>${esc(p.client)}</td>
      <td class="num">${idr(p.spendIdr)}</td>
      <td class="num">${idr(p.budgetIdr)}</td>
      <td class="num"><strong>${pct(p.pctUsed)}</strong></td>
      <td><div class="bar ${s.cls}"><i style="width:${Math.min(100, Math.max(0, p.pctUsed)).toFixed(1)}%"></i></div></td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
    </tr>`; }).join("")}
  </table></div>
</section>

<div class="grid2">
  <section>
    <h2>Spend by tool / vendor</h2>
    <div class="chart"><canvas id="vendorChart"></canvas></div>
    <div class="tablewrap"><table style="margin-top:12px">
      <tr><th>Vendor</th><th class="num">Spend</th><th class="num">Share</th><th class="num">Records</th></tr>
      ${d.vendors.map((v) => `<tr><td>${esc(v.vendor)}</td><td class="num">${idr(v.spendIdr)}</td><td class="num">${pct(d.totals.spendIdr ? (v.spendIdr / d.totals.spendIdr) * 100 : 0)}</td><td class="num">${v.recordCount}</td></tr>`).join("")}
    </table></div>
  </section>
  <section>
    <h2>Weekly spend</h2>
    <p class="hint">Weeks start on Monday (WIB). Refunds reduce the week they were issued in.</p>
    <div class="chart"><canvas id="weeklyChart"></canvas></div>
  </section>
</div>

<section>
  <h2>Records not linked to a project (${d.unassigned.length})</h2>
  <p class="hint">These labels matched no project code, name, or alias. Add the label to <code>config/project_aliases.json</code> and run the import again; the records will move to the right project without being duplicated.</p>
  ${d.unassigned.length === 0 ? `<p class="muted">Everything is linked.</p>` : `<div class="tablewrap"><table>
    <tr><th>Label typed</th><th>Source</th><th>Vendor</th><th>Item</th><th>When (WIB)</th><th class="num">Amount</th></tr>
    ${d.unassigned.map((u) => `<tr><td><code>${esc(u.projectLabel || "(blank)")}</code></td><td>${esc(SOURCE_LABEL[u.source] ?? u.source)}</td><td>${esc(u.vendor)}</td><td>${esc(u.item)}</td><td>${esc(u.occurredAtWib)}</td><td class="num">${idr(u.amountIdr)}</td></tr>`).join("")}
  </table></div>`}
</section>

<div class="grid2">
  <section>
    <h2>Last import per source</h2>
    <div class="tablewrap"><table>
      <tr><th>Source</th><th>When (WIB)</th><th>Status</th><th class="num">Fetched</th><th class="num">New</th><th class="num">Updated</th><th class="num">Skipped</th><th class="num">Removed</th></tr>
      ${d.importRuns.length === 0 ? `<tr><td colspan="8" class="muted">No import has run yet.</td></tr>` : d.importRuns.map((r) => `<tr>
        <td>${esc(SOURCE_LABEL[r.source] ?? r.source)}</td><td>${esc(wibNow(r.startedAt))}</td>
        <td>${r.status === "ok" ? `<span class="badge ok">ok</span>` : `<span class="badge over">failed</span> <span class="muted">${esc(r.error ?? "")}</span>`}</td>
        <td class="num">${r.fetched}</td><td class="num">${r.inserted}</td><td class="num">${r.updated}</td><td class="num">${r.skipped}</td><td class="num">${r.removed}</td></tr>`).join("")}
    </table></div>
  </section>
  <section>
    <h2>Budget alerts sent</h2>
    <div class="tablewrap"><table>
      <tr><th>Project</th><th>Threshold</th><th class="num">Spend at alert</th><th class="num">Used</th><th>Via</th><th>When (WIB)</th></tr>
      ${d.alerts.length === 0 ? `<tr><td colspan="6" class="muted">No alerts yet.</td></tr>` : d.alerts.map((a) => `<tr>
        <td><strong>${esc(a.projectCode)}</strong></td><td>${a.thresholdPct}%</td><td class="num">${idr(a.spendIdr)}</td><td class="num">${pct(a.pctUsed)}</td><td>${esc(a.delivery)}</td><td>${esc(wibNow(a.sentAt))}</td></tr>`).join("")}
    </table></div>
  </section>
</div>
</main>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
  const PALETTE = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#64748b"];
  const fmt = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const color = (ds) => ds.map((s, i) => ({ ...s, backgroundColor: PALETTE[i % PALETTE.length] }));
  const common = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ": " + fmt(c.parsed.y) } } },
    scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => (v / 1e6).toFixed(0) + " jt" }, title: { display: true, text: "IDR (juta)" } } },
  };
  const vendor = ${JSON.stringify(vendorStack)};
  new Chart(document.getElementById("vendorChart"), { type: "bar", data: { labels: vendor.labels, datasets: color(vendor.datasets) }, options: common });
  const weekly = ${JSON.stringify(weeklyStack)};
  new Chart(document.getElementById("weeklyChart"), { type: "bar", data: { labels: weekly.labels, datasets: color(weekly.datasets) }, options: common });
</script>
</body>
</html>`;
}

function renderFlash(li: NonNullable<DashboardData["lastImport"]>): string {
  const failed = li.summaries.filter((s) => s.status === "failed");
  const lines = li.summaries.map((s) =>
    s.status === "ok"
      ? `${esc(s.label)}: ${s.inserted} new, ${s.updated} updated, ${s.unchanged} unchanged, ${s.skipped} skipped${s.removed ? `, ${s.removed} removed` : ""}`
      : `${esc(s.label)}: failed (${esc(s.error)})`,
  );
  return `<div class="flash ${failed.length ? "err" : ""}"><strong>Import finished ${esc(wibNow(li.at))}.</strong> ${lines.join(" · ")}${li.alertsSent ? ` · ${li.alertsSent} budget alert(s) sent` : ""}</div>`;
}
