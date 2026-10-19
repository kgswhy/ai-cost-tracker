import Fastify from "fastify";
import { config } from "../config.js";
import { openDatabase } from "../db/index.js";
import { latestImportRuns, projectSpend, recentAlerts, totals, unassignedRecords, vendorByProject, vendorSpend, weeklySpend } from "../db/queries.js";
import { runImport } from "../importers/index.js";
import { runConfiguredAlerts } from "../alerts/run.js";
import { renderDashboard, type DashboardData } from "./page.js";

const db = openDatabase(config.databasePath);
const app = Fastify({ logger: { level: "info" } });

let lastImport: DashboardData["lastImport"] = null;
let importing: Promise<void> | null = null;

function collect(): DashboardData {
  return {
    generatedAt: new Date().toISOString(),
    totals: totals(db),
    projects: projectSpend(db),
    vendors: vendorSpend(db),
    vendorByProject: vendorByProject(db),
    weekly: weeklySpend(db),
    unassigned: unassignedRecords(db),
    importRuns: latestImportRuns(db),
    alerts: recentAlerts(db),
    thresholds: config.alerts.thresholds,
    lastImport,
  };
}

// Browser form posts arrive urlencoded with an empty body; accept and ignore it.
app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, _body, done) => done(null, {}));

app.get("/", async (_req, reply) => {
  reply.type("text/html; charset=utf-8");
  return renderDashboard(collect());
});

app.get("/api/summary", async () => {
  const { lastImport: _omit, ...data } = collect();
  return data;
});

app.post("/import", async (_req, reply) => {
  if (!importing) {
    importing = (async () => {
      const summaries = await runImport({ db });
      const alerts = await runConfiguredAlerts(db, { log: (m) => app.log.info(m) });
      lastImport = { at: new Date().toISOString(), summaries, alertsSent: alerts.sent.length };
    })().finally(() => { importing = null; });
  }
  await importing;
  return reply.redirect("/", 303);
});

app.get("/health", async () => ({ status: "ok" }));

await app.listen({ port: config.port, host: "0.0.0.0" });
