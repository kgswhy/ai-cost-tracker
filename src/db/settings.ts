import type { Db } from "./index";

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, new Date().toISOString());
}

export function deleteSetting(db: Db, key: string): void {
  db.prepare(`DELETE FROM settings WHERE key = ?`).run(key);
}

export const WEBHOOK_KEY = "alert_webhook_url";

export interface ResolvedWebhook { url: string; origin: "web" | "env" }

/** The URL set on the Budget alert page wins; ALERT_WEBHOOK_URL in .env is the fallback. */
export function resolveWebhook(db: Db, envUrl: string): ResolvedWebhook | null {
  const web = getSetting(db, WEBHOOK_KEY);
  if (web) return { url: web, origin: "web" };
  if (envUrl) return { url: envUrl, origin: "env" };
  return null;
}
