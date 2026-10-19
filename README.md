# AI Production Cost Tracker

[![CI](https://github.com/kgswhy/ai-cost-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/kgswhy/ai-cost-tracker/actions/workflows/ci.yml)

Internal tool that replaces the weekly spreadsheet exercise: it pulls AI production spend from every vendor into one SQLite database, shows spend against budget per project on a dashboard, and posts a webhook alert before a project runs over budget.

Sources: Vendor A (CSV, credits), Vendor B (CSV, USD), Vendor C (REST API, USD cents) and the ops team's manual spreadsheet (IDR). Everything is normalised to IDR and WIB (UTC+7) and linked to the projects in `data/projects.csv`.

## Setup

Requires Node.js 20.11 or newer (tested on 22). No other services.

```bash
npm install
cp .env.example .env        # then set VENDOR_C_API_KEY (and ALERT_WEBHOOK_URL if you have one)
```

The Vendor C key for the mock is in `docs/vendor_c_api.md`. `.env` is git-ignored; nothing secret lives in the repo.

## Running it

Three terminals, or run the first two in the background:

```bash
npm run mock:vendor-c       # the provided Vendor C mock on http://localhost:4010
npm run import              # pull all four sources into data/cost_tracker.db, then evaluate alerts
npm start                   # dashboard on http://localhost:3000
```

Open http://localhost:3000. The **Run import now** button on the dashboard does the same thing as `npm run import`, so the ops team never needs a terminal once the server is up.

### Import

```bash
npm run import                      # all sources
npm run import -- vendor_c          # one source (vendor_a | vendor_b | vendor_c | manual_ops)
npm run import -- --verbose         # print every row-level warning
npm run import -- --no-alerts       # import only
```

Run it as often as you like. A record is identified by its source and vendor-side id, so a re-run reports `unchanged` instead of inserting again, and totals do not move. If a vendor is unreachable the other sources still import; each source gets its own row in `import_runs` and the dashboard shows the last status per source.

### Alerts

When a project's spend crosses a threshold (default **80%**, plus 100%), one message is posted to `ALERT_WEBHOOK_URL` stating the project, current spend, budget and percentage used. The body carries the message as both `content` (Discord) and `text` (Slack), plus a structured `alert` object, so the same URL works for Discord, Slack or a mock endpoint.

Alerts are evaluated automatically at the end of every import, and can be run on their own:

```bash
npm run alerts                      # send anything newly crossed
npm run alerts -- --dry-run         # show what would be sent
npm run alerts -- --reset           # forget sent alerts (useful for demos), then send again
```

Each (project, threshold) pair is announced once; it is recorded in `budget_alerts` and not re-sent on the next import. If `ALERT_WEBHOOK_URL` is empty, alerts are logged and recorded as console-delivered, and they are sent again once a webhook is configured.

To watch it locally without a Discord server:

```bash
npm run mock:webhook                # prints every POST it receives on http://localhost:4020/webhook
ALERT_WEBHOOK_URL=http://localhost:4020/webhook npm run alerts -- --reset
```

With the provided data, GBX-01 (111.6%), INT-00 (91.5%) and KMD-02 (86.0%) trigger alerts.

### Tests

```bash
npm test
npm run typecheck
```

CI (`.github/workflows/ci.yml`) runs the typecheck and unit tests on every push and pull request, then boots the Vendor C mock, imports twice and fails if the second run inserts, updates or removes anything.

## Architecture

```
data/*.csv, *.xlsx ──┐
Vendor C API ────────┤──► importers (one per source) ──► UsageRecord[] ──► SQLite upsert ──► alerts ──► webhook
projects.csv, rates.json, config/project_aliases.json ──► shared normalisers      │
                                                                                 └──► dashboard (Fastify, server-rendered)
```

```
src/
  config.ts              env + paths
  types.ts               UsageRecord, the one shape every source is converted to
  normalize/             pure functions: time (WIB, week buckets), money, project aliases, csv
  importers/             vendorA, vendorB, vendorC (paginated client with retries), manualOps (xlsx)
                         index.ts runs them all, one transaction + import_runs row per source
  db/                    schema.sql, upsert, dashboard queries
  alerts/                threshold evaluation, webhook/console senders, once-per-threshold state
  web/                   Fastify server + HTML renderer (Chart.js from CDN, no build step)
  cli/                   import.ts, alerts.ts
config/project_aliases.json   the nicknames people type -> project code
tools/mock-webhook.mjs        local webhook receiver for demos
tests/                        vitest
```

**Data model.** `usage_records` holds one row per spend line with the original amount and currency, the IDR amount, UTC and WIB timestamps, the Monday of its WIB week, the label the user typed and the project it resolved to. `projects`, `import_runs` and `budget_alerts` are the supporting tables. Refunds are negative rows that reference the original charge.

### Key design decisions

- **SQLite via better-sqlite3.** Single file, no server, synchronous API, transactions. Right size for a tool one team uses; swapping to Postgres later is a schema copy because the queries are plain SQL.
- **One `UsageRecord` shape.** Each importer's only job is to turn its source's quirks into that shape. Everything downstream (upsert, queries, alerts, dashboard) is source-agnostic.
- **Idempotency by natural key.** `UNIQUE(source, external_id)`. Vendor A/B/C provide stable ids. The spreadsheet has none, so its id is a hash of (WIB date, resolved project, vendor, invoice number, amount). A record that changes at the source (a corrected amount, a new alias) updates in place; the CLI reports `inserted / updated / unchanged` so a re-run is visibly a no-op.
- **The ops sheet is a full snapshot.** Rows edited or deleted in the sheet are removed from the DB on the next import. Vendor exports are append-only feeds and are never pruned.
- **Project aliases in a config file, not code.** Users type `kmd02`, `KMD 02`, `Kopi Malam`, `kopi malam drama`; all map to KMD-02. Unknown labels are kept with `project_code = NULL`, summed as "not linked" on the dashboard, and listed so ops can add the alias and re-import. The resolver refuses an alias claimed by two projects.
- **Alerts are stateful and run after every import.** Threshold crossings are recorded; a project crossing 80% and 100% in the same run gets one message for the highest. Failed deliveries are not recorded, so they retry next run.
- **No frontend framework.** One server-rendered page with Chart.js keeps the tool deployable as `npm start` and leaves the effort where the risk is: the data.
- **Money is integer IDR.** Each record is converted and rounded individually, so totals are sums of whole rupiah.

## Assumptions

Things the brief left open, and what I decided:

1. **Refunds reduce spend.** Vendor A refund rows (negative credits with `ref_transaction_id`) are imported as negative records, so budgets reflect net spend and the audit trail keeps both lines.
2. **Manual-sheet "Vendor A" rows are copies, not extra spend.** Every such row matches a `vendor_a.csv` transaction (by the TXN ref where present, otherwise credits × 160 and date). They are skipped; the CSV is the source of truth for Vendor A. Other vendors in the sheet (Tool D, Stock Footage, Stock Music, Freelance VO) have no other feed and are imported.
3. **Manual-sheet dates are WIB calendar days** (the team types them locally; the TXN-ref rows confirm this where the UTC time crosses midnight). They are stored as midnight WIB. Vendor timestamps are UTC as their headers say.
4. **`rnd`, `R&D` and `Internal` mean INT-00 (Internal R&D).** `sandbox`, `test`, `misc`, `new client pitch` and blank labels do not clearly belong to a project and are left unassigned rather than guessed.
5. **A repeated Vendor B `line_id` is the same charge.** Four lines appear twice, byte-for-byte; they are imported once.
6. **A repeated invoice number in the sheet is the same expense** (two cases, e.g. INV-913 typed twice with different formatting).
7. **Weeks start on Monday, in WIB.**
8. **Fixed rates for every record**, as `rates.json` instructs, regardless of date.
9. **Two Vendor B charges of about $1,000** (roughly 15× the typical line) are imported as-is; they look like data-entry or vendor errors but there is no basis in the data to drop them. They are the reason KMD-02 and SNJ-04 carry most of their spend from Vendor B.
10. **Thresholds are 80% and 100%.** The brief asks for 80%; 100% is added because "over budget" is a different conversation from "approaching budget". Configurable via `ALERT_THRESHOLDS`.

### Data quirks handled

| Source | Quirk | Handling |
|---|---|---|
| Vendor A | `MM/DD/YYYY HH:MM`, refunds, project tags in six spellings per project | strict parser, negative records, alias file |
| Vendor B | `DD-MM-YYYY`, `13.21` / `$70.9` / `"$1,036.15"`, duplicate lines | strict parser, money parser, dedupe on `line_id` |
| Vendor C | Bearer auth, pagination, random 429 with `Retry-After`, random 500, cents | paginated client, honours `Retry-After`, exponential backoff on 5xx/network, fails fast on 4xx |
| Manual sheet | title row, blank rows, TOTAL row, Excel serials, `1/9/2026`, `14 Sep 2026`, `01 Okt 2026`, `Rp 1.850.000`, `47.040`, duplicates, Vendor A copies | header detection, multi-format date and IDR parsers, content hash id, overlap skip |

## Known limitations and next steps

- **Spreadsheet identity is content-based.** Editing a sheet row changes its id; the snapshot pruning cleans up the old row, but alert history and `first_seen_at` for that row start over. The fix is to give the sheet an id column, or better, replace it with a small form on the dashboard that writes straight to the DB.
- **Schema migrations are `CREATE TABLE IF NOT EXISTS` only.** Fine for a fresh file; a real deployment would use a migration tool.
- **Rates are fixed.** Real invoices arrive in USD at a date-specific rate; the model keeps original amount and currency so dated rates can be applied later.
- **No authentication on the dashboard** and no CSRF protection on the import button; it is meant to sit on an internal network. Add SSO or at least basic auth before exposing it.
- **Alerts only fire upward.** There is no "back under budget" notice, no digest, and no per-project threshold overrides.
- **Import runs in the web process.** Good enough for ~400 records; with more sources it should move to a scheduled job (cron or a queue) with the dashboard reading results only.
- **Outlier detection** (the $1,000 Vendor B lines) would be a cheap, valuable addition: flag records more than N× the median for their vendor and show them for review.
- **Filtering** by date range or client on the dashboard, and CSV export of the normalised records for finance.

## Notes on the provided materials

`vendor-c-mock/` is untouched except for a one-line `package.json` marking it CommonJS, because the root package is ESM. `data/` is unchanged; the SQLite file is created next to it and git-ignored.
