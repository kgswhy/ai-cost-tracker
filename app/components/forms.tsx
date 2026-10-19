"use client";
import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "../actions";
import { btn, btnSecondary } from "./ui";

export function ResultNotice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <div role="status" className={`border-l-4 px-3.5 py-2.5 text-sm leading-relaxed ${result.ok ? "border-accent bg-ok-bg" : "border-over bg-over-bg"}`}>
      <p className="font-medium">{result.message}</p>
      {result.summaries ? (
        <ul className="mt-1.5 space-y-0.5">
          {result.summaries.map((s) => (
            <li key={s.source}>
              {s.label}: {s.status === "ok"
                ? `${s.inserted} baru, ${s.updated} diperbarui, ${s.unchanged} tidak berubah, ${s.skipped} dilewati${s.removed ? `, ${s.removed} dihapus` : ""}${s.unassigned ? `, ${s.unassigned} tanpa proyek` : ""}`
                : `gagal. ${s.error}`}
            </li>
          ))}
        </ul>
      ) : null}
      {result.details?.length ? <ul className="mt-1.5 space-y-0.5">{result.details.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}
    </div>
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

export function UploadForm({ source, label, accept, action }: {
  source: string; label: string; accept: string; action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`file-${source}`}>Pilih file {label}</label>
        <input
          id={`file-${source}`}
          type="file"
          name="file"
          accept={accept}
          required
          className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:border file:border-ink file:bg-card file:px-3 file:text-sm file:font-medium"
        />
        <button type="submit" className={btnSecondary} disabled={pending}>{pending ? "Menyimpan" : "Ganti file"}</button>
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
  const id = `project-${label.replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="label" value={label} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={id}>Proyek untuk {label}</label>
        <select id={id} name="projectCode" required defaultValue="" className="min-h-11 min-w-0 flex-[1_1_220px] border border-[#999999] bg-card px-2.5 text-sm text-ink">
          <option value="" disabled>Pilih proyek</option>
          {projects.map((p) => <option key={p.code} value={p.code}>{p.code} {p.name}</option>)}
          <option value="skip">Bukan proyek, tandai sudah dicek</option>
        </select>
        <button type="submit" className={btn} disabled={pending}>{pending ? "Menyimpan" : "Simpan"}</button>
      </div>
      <ResultNotice result={result} />
    </form>
  );
}
