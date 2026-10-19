import { discardUploadAction, runImportAction, uploadAction } from "../actions";
import { ActionButton, UploadForm } from "../components/forms";
import { Empty, PageTitle, Section, Table } from "../components/ui";
import { importPageData } from "../lib/data";
import { SOURCE_LABEL, wib } from "../lib/format";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  const d = importPageData();
  return (
    <>
      <PageTitle title="Import" lede="Bring this week's data in. Replace a vendor export or the ops sheet if you have a newer file, then run the import. Running it again never counts anything twice." />
      <div className="grid gap-5">
        <Section title="1. Files in use" hint="Vendor C is pulled from its API. The other three are read from the file shown here: the bundled copy from the repository, or the latest file you uploaded.">
          <div className="grid gap-4">
            {d.files.map((f) => (
              <div key={f.source} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="text-sm">
                  <p className="font-semibold">{f.label}</p>
                  <p className="text-ink-muted">
                    {f.file.origin === "uploaded" ? <>Uploaded <code className="rounded bg-paper px-1 text-xs">{f.file.fileName}</code> on {wib(f.file.updatedAt)}</> : <>Bundled sample <code className="rounded bg-paper px-1 text-xs">data/{f.file.fileName}</code></>}
                  </p>
                  {f.file.origin === "uploaded" ? (
                    <div className="mt-2"><ActionButton action={discardUploadAction.bind(null, f.source)} label="Use the bundled sample again" busyLabel="Removing" secondary /></div>
                  ) : null}
                </div>
                <UploadForm source={f.source} accept={f.accept.join(",")} action={uploadAction} />
              </div>
            ))}
            <div className="rounded-md border border-line p-3 text-sm">
              <p className="font-semibold">Vendor C usage API</p>
              <p className="text-ink-muted">{d.vendorC.baseUrl}. API key {d.vendorC.keyConfigured ? "configured in .env" : <span className="text-over">missing: set VENDOR_C_API_KEY in .env</span>}.</p>
            </div>
          </div>
        </Section>

        <Section title="2. Run the import" hint="Reads all four sources, converts to IDR and WIB, links records to projects, then checks budgets and sends any new alert. Takes about ten seconds because Vendor C rate-limits.">
          <ActionButton action={runImportAction} label="Run import now" busyLabel="Importing, about 10 seconds" />
        </Section>

        <Section title="3. Last import per source">
          {d.latest.length === 0 ? <Empty>No import has run yet. Press Run import now above.</Empty> : (
            <Table label="Last import per source">
              <thead><tr><th>Source</th><th>When (WIB)</th><th>Status</th><th className="text-right">Fetched</th><th className="text-right">New</th><th className="text-right">Updated</th><th className="text-right">Unchanged</th><th className="text-right">Skipped</th><th className="text-right">Removed</th></tr></thead>
              <tbody>{d.latest.map((r) => (
                <tr key={r.id}>
                  <td>{SOURCE_LABEL[r.source] ?? r.source}</td><td>{wib(r.startedAt)}</td>
                  <td>{r.status === "ok" ? <span className="rounded bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok">ok</span> : <><span className="rounded bg-over-bg px-2 py-0.5 text-xs font-semibold text-over">failed</span> <span className="text-ink-muted">{r.error}</span></>}</td>
                  <td className="text-right">{r.fetched}</td><td className="text-right">{r.inserted}</td><td className="text-right">{r.updated}</td><td className="text-right">{r.unchanged}</td><td className="text-right">{r.skipped}</td><td className="text-right">{r.removed}</td>
                </tr>))}</tbody>
            </Table>
          )}
        </Section>

        <Section title="History" hint="Every run, newest first. Open a row to see what the importer skipped and why.">
          {d.history.length === 0 ? <Empty>Nothing yet.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {d.history.map((r) => (
                <li key={r.id} className="py-2">
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-40 font-medium">{SOURCE_LABEL[r.source] ?? r.source}</span>
                      <span className="text-ink-muted">{wib(r.startedAt)}</span>
                      <span className={r.status === "ok" ? "text-ok" : "text-over"}>{r.status}</span>
                      <span className="text-ink-muted">{r.status === "ok" ? `${r.inserted} new, ${r.updated} updated, ${r.unchanged} unchanged, ${r.skipped} skipped${r.removed ? `, ${r.removed} removed` : ""}` : r.error}</span>
                      {r.warnings.length ? <span className="text-ink-muted">({r.warnings.length} note{r.warnings.length > 1 ? "s" : ""})</span> : null}
                    </summary>
                    {r.warnings.length ? <ul className="mt-1 list-disc space-y-0.5 pl-6 text-ink-muted">{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <p className="mt-1 pl-1 text-ink-muted">Nothing skipped.</p>}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
