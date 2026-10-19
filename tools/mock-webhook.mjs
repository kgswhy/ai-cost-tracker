// Tiny webhook receiver for local demos: prints whatever is POSTed to it.
// Usage: node tools/mock-webhook.mjs   (listens on http://localhost:4020/webhook)
import http from "node:http";

const port = Number(process.env.WEBHOOK_PORT) || 4020;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    console.log(`\n${new Date().toISOString()} ${req.method} ${req.url}`);
    try { console.log(JSON.stringify(JSON.parse(body), null, 2)); } catch { console.log(body); }
    res.writeHead(204).end();
  });
}).listen(port, () => console.log(`Mock webhook listening on http://localhost:${port}/webhook`));
