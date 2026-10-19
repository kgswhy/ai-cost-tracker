import { config } from "../config";
import { openDatabase, type Db } from "./index";

// One connection per process. Next.js reloads modules in development, so the
// handle is parked on globalThis to survive hot reloads.
const g = globalThis as unknown as { __costTrackerDb?: Db };

export function getDb(): Db {
  if (!g.__costTrackerDb) g.__costTrackerDb = openDatabase(config.databasePath);
  return g.__costTrackerDb;
}
