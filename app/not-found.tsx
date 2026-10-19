import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Halaman ini tidak ada</h1>
      <p className="mt-2 text-sm text-ink-muted">Kode proyek bentuknya seperti KMD-02. <Link href="/">Kembali ke Dashboard</Link>.</p>
    </div>
  );
}
