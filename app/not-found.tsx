import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-sm text-ink-muted">Project codes look like KMD-02. <Link href="/" className="underline">Back to the dashboard</Link>.</p>
    </div>
  );
}
