"use client";
import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "../actions";
import { btn, btnSecondary, Notice } from "./ui";

export function ResultNotice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <Notice ok={result.ok}>
      <p className="font-medium">{result.message}</p>
      {result.summaries ? (
        <ul className="mt-2 space-y-0.5">
          {result.summaries.map((s) => (
            <li key={s.source}>
              {s.label}: {s.status === "ok"
                ? `${s.inserted} new, ${s.updated} updated, ${s.unchanged} unchanged, ${s.skipped} skipped${s.removed ? `, ${s.removed} removed` : ""}${s.unassigned ? `, ${s.unassigned} not linked` : ""}`
                : `failed. ${s.error}`}
            </li>
          ))}
        </ul>
      ) : null}
      {result.details?.length ? <ul className="mt-2 space-y-0.5">{result.details.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}
    </Notice>
  );
}

/** A button that runs a server action with no inputs and shows its result underneath. */
export function ActionButton({ action, label, busyLabel, secondary, confirm }: {
  action: () => Promise<ActionResult>; label: string; busyLabel: string; secondary?: boolean; confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="space-y-3">
      <button
        type="button"
        className={secondary ? btnSecondary : btn}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setResult(await action()));
        }}
      >
        {pending ? busyLabel : label}
      </button>
      <ResultNotice result={result} />
    </div>
  );
}

export function UploadForm({ source, accept, action }: { source: string; accept: string; action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult> }) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept={accept}
          required
          aria-label={`Choose a ${accept} file for ${source}`}
          className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-line file:bg-card file:px-3 file:text-sm file:font-medium"
        />
        <button type="submit" className={btnSecondary} disabled={pending}>{pending ? "Saving" : "Replace file"}</button>
      </div>
      <ResultNotice result={result} />
    </form>
  );
}

export function LinkLabelForm({ label, projects, action }: {
  label: string; projects: { code: string; name: string }[]; action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  if (result?.ok) return <ResultNotice result={result} />;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="label" value={label} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="projectCode" required defaultValue="" aria-label={`Project for label ${label}`} className="min-h-11 rounded-md border border-line bg-card px-3 text-sm">
          <option value="" disabled>Choose a project</option>
          {projects.map((p) => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
        </select>
        <button type="submit" className={btn} disabled={pending}>{pending ? "Linking" : "Link"}</button>
      </div>
      <ResultNotice result={result} />
    </form>
  );
}
