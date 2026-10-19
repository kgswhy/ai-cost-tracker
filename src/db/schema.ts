export const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  client      TEXT NOT NULL,
  budget_idr  INTEGER NOT NULL
);

-- One row per spend line from any source. (source, external_id) is the
-- idempotency key: re-importing the same line updates it in place.
CREATE TABLE IF NOT EXISTS usage_records (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  source            TEXT NOT NULL,
  external_id       TEXT NOT NULL,
  vendor            TEXT NOT NULL,
  item              TEXT NOT NULL,
  project_label     TEXT NOT NULL,
  project_code      TEXT REFERENCES projects(code),
  occurred_at_utc   TEXT NOT NULL,
  occurred_at_wib   TEXT NOT NULL,
  week_start_wib    TEXT NOT NULL,
  original_amount   REAL NOT NULL,
  original_currency TEXT NOT NULL,
  amount_idr        INTEGER NOT NULL,
  refund_of         TEXT,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_records(project_code);
CREATE INDEX IF NOT EXISTS idx_usage_week ON usage_records(week_start_wib);

-- Labels the ops team mapped to a project from the dashboard. The config file
-- holds the starting set; rows here are added at runtime and win on conflict.
CREATE TABLE IF NOT EXISTS project_aliases (
  label         TEXT PRIMARY KEY,   -- normalised: trimmed, lower-case, single spaces
  project_code  TEXT NOT NULL REFERENCES projects(code),
  created_at    TEXT NOT NULL
);

-- Names the ops team checked and decided belong to no project ("test",
-- "new client pitch"). Their spend stays unassigned but leaves the to-do list.
CREATE TABLE IF NOT EXISTS reviewed_labels (
  label       TEXT PRIMARY KEY,   -- normalised like project_aliases.label
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL,
  fetched      INTEGER NOT NULL DEFAULT 0,
  inserted     INTEGER NOT NULL DEFAULT 0,
  updated      INTEGER NOT NULL DEFAULT 0,
  unchanged    INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
  removed      INTEGER NOT NULL DEFAULT 0,
  warnings     TEXT,
  error        TEXT
);

-- One row per (project, threshold) so an alert is sent once, not on every import.
CREATE TABLE IF NOT EXISTS budget_alerts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code   TEXT NOT NULL REFERENCES projects(code),
  threshold_pct  INTEGER NOT NULL,
  spend_idr      INTEGER NOT NULL,
  budget_idr     INTEGER NOT NULL,
  pct_used       REAL NOT NULL,
  delivery       TEXT NOT NULL,
  sent_at        TEXT NOT NULL,
  UNIQUE (project_code, threshold_pct)
);
`;
