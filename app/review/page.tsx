import { linkLabelAction } from "../actions";
import { LinkLabelForm } from "../components/forms";
import { Empty, PageTitle, Section, Table } from "../components/ui";
import { reviewPageData } from "../lib/data";
import { idr, SOURCE_LABEL } from "../lib/format";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const d = reviewPageData();
  const projects = d.projects.map((p) => ({ code: p.code, name: p.name }));
  return (
    <>
      <PageTitle title="Review labels" lede="People type project names however they like in the vendor tools. Labels that matched no project code, name or alias land here. Link a label once and every record with it, now and in future imports, goes to that project." />
      <div className="grid gap-5">
        <Section title={`Labels waiting (${d.groups.length})`} hint="Sorted by amount. A blank label cannot be linked; those records need a label at the source.">
          {d.groups.length === 0 ? <Empty>Every record is linked to a project.</Empty> : (
            <ul className="divide-y divide-line">
              {d.groups.map((g) => (
                <li key={g.label} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="text-sm">
                    <p><code className="rounded bg-paper px-1.5 py-0.5 text-sm">{g.label || "(blank)"}</code> <span className="ml-2 font-semibold">{idr(g.spendIdr)}</span></p>
                    <p className="mt-1 text-ink-muted">{g.recordCount} record(s) from {g.sources.split(",").map((s) => SOURCE_LABEL[s] ?? s).join(", ")}. Last seen {g.lastSeenWib} WIB.</p>
                  </div>
                  {g.label ? <LinkLabelForm label={g.label} projects={projects} action={linkLabelAction} /> : <p className="text-sm text-ink-muted">Fix at the source.</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Aliases added here" hint={`${d.configAliasCount} aliases ship in config/project_aliases.json. The ones below were added from this page and take precedence.`}>
          {d.userAliases.length === 0 ? <Empty>None yet.</Empty> : (
            <Table label="Aliases added from the dashboard">
              <thead><tr><th>Label</th><th>Project</th><th>Added (WIB)</th></tr></thead>
              <tbody>{d.userAliases.map((a) => <tr key={a.label}><td><code className="rounded bg-paper px-1 text-xs">{a.label}</code></td><td>{a.projectCode}</td><td>{a.createdAt.slice(0, 10)}</td></tr>)}</tbody>
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
