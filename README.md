# AI Production Cost Tracker

[![CI](https://github.com/kgswhy/ai-cost-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/kgswhy/ai-cost-tracker/actions/workflows/ci.yml)

Internal tool that replaces the weekly spreadsheet exercise: it pulls AI production spend from every vendor into one SQLite database, shows spend against budget per project, and posts a webhook alert before a project runs over budget.

Sources: Vendor A (CSV, credits), Vendor B (CSV, USD), Vendor C (REST API, USD cents) and the ops team's manual spreadsheet (IDR). Everything is normalised to IDR and WIB (UTC+7) and linked to the projects in `data/projects.csv`.

## Setup

Requires Node.js 20.11 or newer (tested on 22). No other services.

```bash
npm install
cp .env.example .env        # then set VENDOR_C_API_KEY (and ALERT_WEBHOOK_URL if you have one)
```

The Vendor C key for the mock is in `docs/vendor_c_api.md`. `.env` is git-ignored; nothing secret lives in the repo.

## Running it

```bash
npm run mock:vendor-c       # the provided Vendor C mock on http://localhost:4010
npm run dev                 # the app on http://localhost:3000
```

Then open http://localhost:3000/import and press **Jalankan import**. For production use `npm run build && npm start`.

### The weekly flow

The interface is in Indonesian, the ops team's working language (their own spreadsheet is "Rekap Biaya Produksi", with "Tanggal" and "Nominal" columns). A sidebar holds the **Dashboard** and the weekly routine in order, plus every project with its budget percentage:

- **Dashboard** (`/`). Total spend across the six projects against total budget, then *Spend vs budget per proyek* (spend, budget, % budget terpakai, status, and what happens if the last four weeks' pace continues), *Spend per tool / vendor* and *Spend mingguan*. Spend with no project is shown separately so the project total is not inflated. A yellow note above the table says when unusual charges sit inside a project and what its percentage would be without them. A short list says what needs a decision this week.
1. **Import data** (`/import`). Which file each source reads: the bundled sample from `data/`, or the latest upload. Upload this week's Vendor A and Vendor B exports and the manual spreadsheet, then run the import; Vendor C is pulled from its API. Every run is logged per source: read, new, updated, unchanged, skipped, removed, and why.
2. **Nama tak dikenal** (`/review`). Transactions whose project name matched nothing, grouped by the name as typed, with the transactions behind each one. Pick the project once and every transaction with that name moves now and in future imports; or mark it "not a project" (`test`, `new client pitch`) so it stops asking. A blank name cannot be matched and says to fix it at the source.
3. **Tagihan janggal** (`/charges`). Charges at least 8 times the median for the same vendor and item (so a video render is never compared with an image job), with what each affected project's percentage would be without them.
4. **Budget alert** (`/alerts`). Thresholds, where alerts go, every alert sent, and the exact message the webhook received.

Each project has a page (`/projects/KMD-02`) with its pace, vendor split, weekly spend and every transaction. Every list of transactions downloads as CSV for finance (`/export`, or `/export?project=KMD-02`).

### Import from the command line

```bash
npm run import                      # all sources, then evaluate alerts
npm run import -- vendor_c          # one source (vendor_a | vendor_b | vendor_c | manual_ops)
npm run import -- --verbose         # print every row-level note
npm run import -- --no-alerts       # import only
```

Run it as often as you like. A record is identified by its source and vendor-side id, so a re-run reports `unchanged` instead of inserting again, and totals do not move. If a vendor is unreachable the other sources still import; each source gets its own row in `import_runs`.

### Alerts

When a project's spend crosses a threshold (default 80%, plus 100%), one message is posted to the team's webhook stating the project, current spend, budget and percentage used:

```
Peringatan budget (80%): KMD-02 Kopi Malam Mini Drama S1 (Kopi Malam)
Spend saat ini: Rp 48.151.626
Budget: Rp 56.000.000
Budget terpakai: 86,0%
```

**Slack or Discord.** Paste the webhook URL on the Budget alert page (or set `ALERT_WEBHOOK_URL` in `.env`). The app tells the tool from the URL and sends each one its own format:

| URL | Sent as |
|---|---|
| `https://hooks.slack.com/services/...` | Slack: `{ "text" }`, first line bold in mrkdwn, `& < >` escaped |
| `https://discord.com/api/webhooks/...` | Discord: `{ "content", "username", "allowed_mentions": { "parse": [] } }`, first line bold, no one pinged |
| anything else (a mock, another service) | `{ "content", "text", "alert" }` with the structured alert |

A URL saved on the page is stored in the local database and wins over `.env`; removing it falls back to `.env`. The page only ever shows the host and the last four characters, never the full URL, because a webhook URL works like a password. **Kirim pesan uji** posts a test message so the team can see it arrive before the first real alert. Slack and Discord payloads are covered by unit tests; they have not been tried against a live workspace from this repo.

Alerts are evaluated automatically at the end of every import and after a name is linked, from the Budget alert page, or from the command line:

```bash
npm run alerts                      # send anything newly crossed
npm run alerts -- --dry-run         # show what would be sent
npm run alerts -- --reset           # forget sent alerts (useful for demos), then send again
```

Each (project, threshold) pair is announced once; it is recorded in `budget_alerts` and not re-sent on the next import. If `ALERT_WEBHOOK_URL` is empty, alerts are recorded as console-delivered, and they are sent again once a webhook is configured.

To watch it locally without a chat tool:

```bash
npm run mock:webhook                # prints every POST it receives on http://localhost:4020/webhook
ALERT_WEBHOOK_URL=http://localhost:4020/webhook npm run alerts -- --reset
```

With the provided data, GBX-01 (111.6%), INT-00 (91.5%) and KMD-02 (86.0%) trigger alerts.

### Tests

```bash
npm test
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the typecheck, unit tests and the Next.js build on every push and pull request, then boots the Vendor C mock, imports twice and fails if the second run inserts, updates or removes anything. The Vendor C key comes from the `VENDOR_C_API_KEY` repository secret, so a fork needs to set it before the smoke job can run.

## Architecture

```
data/*.csv, *.xlsx, data/uploads/* ──┐
Vendor C API ────────────────────────┤──► importers (one per source) ──► UsageRecord[] ──► SQLite upsert ──► alerts ──► webhook
projects.csv, rates.json, aliases ───┘                                                        ▲
                                                                              Next.js app (server components + server actions)
```

```
src/                       the core, no framework, used by the CLI and the app
  config.ts                env + paths
  types.ts                 UsageRecord, the one shape every source is converted to
  normalize/               pure functions: time (WIB, week buckets), money, project aliases, csv
  importers/               vendorA, vendorB, vendorC (paginated client with retries), manualOps (xlsx)
                           files.ts picks the uploaded file or the bundled sample; index.ts runs everything
  db/                      schema, upsert, aliases, dashboard queries
  alerts/                  threshold evaluation, webhook/console senders, once-per-threshold state
  cli/                     import.ts, alerts.ts
src/analysis/              pace projection, outlier detection, CSV export: pure functions with their own tests
app/                       Next.js 15 (App Router): / dashboard, /import, /review, /charges, /alerts, /projects/[code], /export (CSV)
  actions.ts               server actions: run import, upload/discard a file, link or dismiss a name, check/reset alerts
  lib/data.ts              one loader per page plus the sidebar's, all reading SQLite on the server
  lib/format.ts            Indonesian number, date and status wording
  components/              sidebar (client, for the phone menu), ledger primitives, forms (client)
config/project_aliases.json    the starting set of nicknames -> project code
tools/mock-webhook.mjs         local webhook receiver for demos
tests/                         vitest
```

**Data model.** `usage_records` holds one row per spend line with the original amount and currency, the IDR amount, UTC and WIB timestamps, the Monday of its WIB week, the label the user typed and the project it resolved to. `projects`, `project_aliases`, `reviewed_labels` (names marked "not a project"), `settings` (the webhook URL set in the app), `import_runs` and `budget_alerts` are the supporting tables. Refunds are negative rows that reference the original charge.

### Key design decisions

SQLite through better-sqlite3: a single file, no server, synchronous calls and real transactions. That is the right size for a tool one team uses, and the queries are plain SQL, so moving to Postgres later is a schema copy.

Every importer produces the same `UsageRecord` shape. An importer's only job is to turn its source's quirks into that shape; the upsert, the queries, the alerts and the pages never know which vendor a row came from.

Idempotency comes from a natural key, `UNIQUE(source, external_id)`. Vendors A, B and C ship stable ids. The spreadsheet has none, so its id is a hash of WIB date, resolved project, vendor, invoice number and amount. A record that changes at the source (a corrected amount, a new alias) updates in place, and every run reports inserted, updated and unchanged counts so a re-run is visibly a no-op.

The ops sheet is treated as a full snapshot: rows edited or deleted in the sheet disappear from the database on the next import. Vendor exports are append-only feeds and are never pruned.

Project aliases start in a config file and grow from the Nama tak dikenal page. People type `kmd02`, `KMD 02`, `Kopi Malam` and `kopi malam drama`; all of them map to KMD-02. A label nobody anticipated is linked once from the dashboard, stored in `project_aliases`, and wins over the config file. Unknown labels stay in the database with no project rather than being guessed. The resolver refuses an alias claimed by two projects.

Uploads replace the bundled sample per source and live in `data/uploads/` (git-ignored). The importer does not care where the file came from, so the CLI and the app read the same thing.

Alerts keep state and run after every import and after every label link. Each threshold crossing is recorded once; a project that passes 80% and 100% in the same run gets a single message for the highest. A failed delivery is not recorded, so it retries on the next run.

Next.js with server components: every page reads SQLite on the server and ships HTML, charts included (they are plain CSS bars); the only client code is the forms and the phone menu. Server actions replace an API layer for the five things a user can do. There is no build step for the CLI, which still runs through tsx.

Money is integer IDR. Each record is converted and rounded on its own, so every total is a sum of whole rupiah.

### Interface design

The look is a ledger: white paper, black ink, hairline rules, no cards. An internal tool the ops team reads every day should look like a finance report, not a product. Section titles use the brief's own terms (spend vs budget per project, spend per tool / vendor, weekly spend, budget alert) so the screen and the requirements read the same. The sidebar is the weekly routine in order, each step with a live count, so a new person knows what to do next without reading this file.

Colour appears only where it carries state: green for on track, amber and red for 80% and 100%, yellow for "being checked". The budget bar, with a hairline at the 80% mark, is the recurring element. Unusual charges are drawn as a yellow segment inside the vendor and weekly bars, so their effect on a total is visible rather than hidden in a footnote. IBM Plex Sans carries the text and IBM Plex Mono every figure, so amounts line up in columns like a ledger. The app ships in light mode only; it is used on office laptops in daylight, and a single theme is one theme to verify. Below 1024 px the sidebar collapses into a top bar with a Menu button.

## Assumptions

Things the brief left open, and what I decided:

1. Refunds reduce spend. Vendor A refund rows (negative credits with `ref_transaction_id`) are imported as negative records, so budgets reflect net spend and the audit trail keeps both lines.
2. The "Vendor A" rows in the manual sheet are copies, not extra spend. Every one of them matches a `vendor_a.csv` transaction, by TXN ref where present and otherwise by credits × 160 and date. They are skipped; the CSV is the source of truth for Vendor A. The other vendors in the sheet (Tool D, Stock Footage, Stock Music, Freelance VO) have no other feed and are imported.
3. Manual-sheet dates are WIB calendar days. The team types them locally, and the rows with a TXN ref confirm it where the UTC time crosses midnight. They are stored as midnight WIB. Vendor timestamps are UTC, as their headers say.
4. `rnd`, `R&D` and `Internal` mean INT-00 (Internal R&D). `sandbox`, `test`, `misc`, `new client pitch` and blank labels do not clearly belong to a project and are left for the ops team to link on the Review names page rather than guessed.
5. A repeated Vendor B `line_id` is the same charge. Four lines appear twice, byte for byte, and are imported once.
6. A repeated invoice number in the sheet is the same expense. There are two cases, such as INV-913 typed twice with different formatting.
7. Weeks start on Monday, in WIB.
8. Fixed rates apply to every record, as `rates.json` instructs, regardless of date.
9. Two Vendor B charges of about $1,000, roughly 15 times the typical line, are imported as they are. They look like data-entry or vendor errors, but nothing in the data justifies dropping them. They are why KMD-02 and SNJ-04 carry most of their spend from Vendor B.
10. Thresholds are 80% and 100%. The brief asks for 80%; 100% is added because "over budget" is a different conversation from "approaching budget". Both are configurable through `ALERT_THRESHOLDS`.
11. The weekly vendor exports and the ops sheet are uploaded by the ops team through the Import page. The brief did not say how files arrive, and the background describes a team that exports them by hand each week, so the tool accepts them there; the bundled files in `data/` are the sample for the first run.
12. The pace projection is deliberately naive: the average of the last four weeks of data, including weeks with no spend, extended in a straight line. Production spend is lumpy and the tool has no schedule to know that, so the page calls it a prompt to check, not a forecast.
13. An "unusually large" charge is one at least 8 times the median of charges with the same vendor and item, with at least five such charges to compare against. The two $1,000 Vendor B lines are the reason this exists; they stay in the totals and are listed for a human to check.

### Data quirks handled

| Source | Quirk | Handling |
|---|---|---|
| Vendor A | `MM/DD/YYYY HH:MM`, refunds, project tags in six spellings per project | strict parser, negative records, alias file |
| Vendor B | `DD-MM-YYYY`, `13.21` / `$70.9` / `"$1,036.15"`, duplicate lines | strict parser, money parser, dedupe on `line_id` |
| Vendor C | Bearer auth, pagination, random 429 with `Retry-After`, random 500, cents | paginated client, honours `Retry-After`, exponential backoff on 5xx/network, fails fast on 4xx |
| Manual sheet | title row, blank rows, TOTAL row, Excel serials, `1/9/2026`, `14 Sep 2026`, `01 Okt 2026`, `Rp 1.850.000`, `47.040`, duplicates, Vendor A copies | header detection, multi-format date and IDR parsers, content hash id, overlap skip |

## Known limitations and next steps

- Spreadsheet identity is content-based. Editing a sheet row changes its id; the snapshot pruning removes the old row, but alert history and `first_seen_at` for that row start over. The fix is an id column in the sheet, or better, a small form on the dashboard that writes straight to the database so the sheet goes away.
- Schema migrations are `CREATE TABLE IF NOT EXISTS` plus one additive column check. Fine for a fresh file; a real deployment would use a migration tool.
- Rates are fixed. Real invoices arrive in USD at a date-specific rate; the model keeps the original amount and currency so dated rates can be applied later.
- There is no authentication. The app is meant for an internal network; add SSO or at least basic auth before exposing it. Without it, anyone who can open the app can also change where budget alerts are sent. Uploads are validated by extension and parsed by the same strict importers, but a hostile file is not something the current checks are designed for.
- Alerts only fire upward. There is no "back under budget" notice, no digest, and no per-project threshold overrides.
- Import runs inside the web process. That is fine for a few hundred records; with more sources it should move to a scheduled job, with the app only reading results.
- Outliers are flagged, not resolved. Marking a charge as "checked, it is real" or "disputed with the vendor" would need a small table and a form; today the list just stays until the data changes.
- Filtering by date range or client on the dashboard.

## Notes on the provided materials

`vendor-c-mock/` is untouched except for a one-line `package.json` marking it CommonJS, because the root package is ESM. `data/` is unchanged; the SQLite file and any uploads are created next to it and git-ignored.
