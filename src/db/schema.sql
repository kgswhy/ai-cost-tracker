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
  occurred_at_utc   TEXT NOT NULL,   -- ISO 8601, Z
  occurred_at_wib   TEXT NOT NULL,   -- "YYYY-MM-DD HH:MM:SS" in UTC+7
  week_start_wib    TEXT NOT NULL,   -- Monday of the WIB week, "YYYY-MM-DD"
  original_amount   REAL NOT NULL,
  original_currency TEXT NOT NULL,
  amount_idr        INTEGER NOT NULL, -- negative for refunds
  refund_of         TEXT,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_records(project_code);
CREATE INDEX IF NOT EXISTS idx_usage_week ON usage_records(week_start_wib);

CREATE TABLE IF NOT EXISTS import_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL,          -- running | ok | failed
  fetched      INTEGER NOT NULL DEFAULT 0,
  inserted     INTEGER NOT NULL DEFAULT 0,
  updated      INTEGER NOT NULL DEFAULT 0,
  unchanged    INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
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
  delivery       TEXT NOT NULL,          -- webhook | console
  sent_at        TEXT NOT NULL,
  UNIQUE (project_code, threshold_pct)
);
