import type { BudgetAlert } from "./index";

export type WebhookProvider = "slack" | "discord" | "generic";

export const PROVIDER_LABEL: Record<WebhookProvider, string> = { slack: "Slack", discord: "Discord", generic: "Webhook lain" };

/** Which chat tool a webhook URL belongs to, from its host and path. */
export function detectProvider(url: string): WebhookProvider {
  let u: URL;
  try { u = new URL(url); } catch { return "generic"; }
  if (u.hostname === "hooks.slack.com") return "slack";
  if (/^(ptb\.|canary\.)?discord(app)?\.com$/.test(u.hostname) && u.pathname.startsWith("/api/webhooks/")) return "discord";
  return "generic";
}

/**
 * Checks a URL typed on the Budget alert page. The page has no login, so it only
 * accepts Slack and Discord webhooks over https: otherwise anyone could point the
 * server at an internal address. Any other target (a mock, a different service)
 * is a developer decision and goes in ALERT_WEBHOOK_URL. Returns an Indonesian
 * error message, or null when the URL is usable.
 */
export function validateWebhookUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return "Isi URL webhook dulu.";
  let u: URL;
  try { u = new URL(url); } catch { return "Itu bukan URL. Salin URL lengkap yang dimulai dengan https://"; }
  if (u.protocol !== "https:") return "URL webhook harus diawali https://";
  if (u.username || u.password || u.port) return "URL webhook tidak boleh berisi username, password atau port.";
  if (u.hostname === "hooks.slack.com") return u.pathname.startsWith("/services/") ? null : "URL Slack harus berbentuk https://hooks.slack.com/services/...";
  if (detectProvider(url) === "discord") return null;
  if (/(^|\.)discord(app)?\.com$/.test(u.hostname)) return "URL Discord harus berbentuk https://discord.com/api/webhooks/...";
  return "Halaman ini hanya menerima webhook Slack (hooks.slack.com) atau Discord (discord.com/api/webhooks). Tujuan lain diatur developer lewat ALERT_WEBHOOK_URL.";
}

/** "hooks.slack.com/…/x9Qa": enough to recognise the destination without exposing the token. */
export function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.replace(/\/+$/, "").slice(-4);
    return `${u.host}/…/${tail}`;
  } catch {
    return "(URL tidak valid)";
  }
}

const slackEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const discordEscape = (s: string) => s.replace(/([*_~`|\\>])/g, "\\$1");

/**
 * The JSON each tool expects. Slack reads `text` (mrkdwn, *bold*), Discord reads
 * `content` (markdown, **bold**) and must not ping anyone; anything else gets
 * both fields plus the structured alert, which is what the mock prints.
 */
export function buildPayload(provider: WebhookProvider, message: string, alert: BudgetAlert | null): Record<string, unknown> {
  const [head, ...rest] = message.split("\n");
  if (provider === "slack") {
    return { text: [`*${slackEscape(head)}*`, ...rest.map(slackEscape)].join("\n") };
  }
  if (provider === "discord") {
    return {
      username: "AI Production Cost Tracker",
      content: [`**${discordEscape(head)}**`, ...rest.map(discordEscape)].join("\n"),
      allowed_mentions: { parse: [] },
    };
  }
  return { content: message, text: message, alert };
}

export const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * POSTs the payload and throws a readable error when it fails. A slow endpoint
 * must not hang the import that triggered it, hence the timeout. The response
 * body is shown only for Slack and Discord, whose short error codes help
 * ("invalid_token"); for any other host it could leak what an internal service says.
 */
export async function postWebhook(url: string, payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch, timeoutMs = WEBHOOK_TIMEOUT_MS): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new Error(timedOut ? `Webhook tidak menjawab dalam ${Math.round(timeoutMs / 1000)} detik.` : `Webhook tidak bisa dihubungi: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const detail = detectProvider(url) === "generic" ? "" : (await res.text().catch(() => "")).slice(0, 80);
    throw new Error(`Webhook menjawab ${res.status}${detail ? ` (${detail})` : ""}.`);
  }
}

export const TEST_MESSAGE = "Pesan uji dari AI Production Cost Tracker\nKalau pesan ini muncul, budget alert akan dikirim ke channel ini.";
