import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./components/sidebar";
import { shellData } from "./lib/data";

// Plex Sans for text, Plex Mono for every figure: amounts line up in columns and read like a ledger.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "AI Production Cost Tracker",
  description: "Spend vs budget per proyek dari semua vendor AI dan spreadsheet manual.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plex.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans lg:flex">
        <Sidebar data={shellData()} />
        <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pt-7">{children}</main>
      </body>
    </html>
  );
}
