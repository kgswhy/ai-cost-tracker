// Vendor C usage API (mock). No dependencies: run with `node server.js`.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4010;
const API_KEY = "vc_test_7Kq2mX9pL4";
const FAIL_RATE = process.env.VC_FAIL_RATE !== undefined ? Number(process.env.VC_FAIL_RATE) : 0.2;
const MAX_PER_PAGE = 100;

const records = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const started = Date.now();
  res.on("finish", () => {
    console.log(`${new Date().toISOString()} ${req.method} ${url.pathname}${url.search} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  if (url.pathname === "/health") return send(res, 200, { status: "ok" });
  if (req.method !== "GET" || url.pathname !== "/v1/usage") {
    return send(res, 404, { error: "not_found", message: "Unknown endpoint" });
  }
  if ((req.headers["authorization"] || "") !== `Bearer ${API_KEY}`) {
    return send(res, 401, { error: "unauthorized", message: "Missing or invalid API key" });
  }

  const roll = Math.random();
  if (roll < FAIL_RATE * 0.75) {
    return send(res, 429, { error: "rate_limited", message: "Too many requests" }, { "Retry-After": "2" });
  }
  if (roll < FAIL_RATE) {
    return send(res, 500, { error: "internal_error", message: "Something went wrong" });
  }

  const page = url.searchParams.has("page") ? Number(url.searchParams.get("page")) : 1;
  let perPage = url.searchParams.has("per_page") ? Number(url.searchParams.get("per_page")) : 25;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1) {
    return send(res, 400, { error: "bad_request", message: "page and per_page must be positive integers" });
  }
  perPage = Math.min(perPage, MAX_PER_PAGE);

  const start = (page - 1) * perPage;
  const data = records.slice(start, start + perPage);
  send(res, 200, {
    data,
    page,
    per_page: perPage,
    total: records.length,
    has_more: start + perPage < records.length,
  });
});

server.listen(PORT, () => {
  console.log(`Vendor C mock API listening on http://localhost:${PORT}`);
});
