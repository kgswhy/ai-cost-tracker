import { config } from "../config";
import { openDatabase, type Db } from "./index";
import { SCHEMA } from "./schema";

// One connection per process. Next.js reloads modules in development, so the
// handle is parked on globalThis to survive hot reloads; when the schema text
// changes during development, the (idempotent) schema runs again on that handle.
const g = globalThis as unknown as { __costTrackerDb?: Db; __costTrackerSchema?: string };

export function getDb(): Db {
  if (!g.__costTrackerDb) {
    g.__costTrackerDb = openDatabase(config.databasePath);
    g.__costTrackerSchema = SCHEMA;
  } else if (g.__costTrackerSchema !== SCHEMA) {
    g.__costTrackerDb.exec(SCHEMA);
    g.__costTrackerSchema = SCHEMA;
  }
  return g.__costTrackerDb;
}
