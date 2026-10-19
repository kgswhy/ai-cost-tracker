import type { BudgetAlert } from "./index";

export type WebhookProvider = "slack" | "discord" | "generic";

export const PROVIDER_LABEL: Record<WebhookProvider, string> = { slack: "Slack", discord: "Discord", generic: "Webhook lain" };

const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");

/** Which chat tool a webhook URL belongs to, from its host and path. */
export function detectProvider(url: string): WebhookProvider {
  let u: URL;
  try { u = new URL(url); } catch { return "generic"; }
  if (u.hostname === "hooks.slack.com") return "slack";
  if (/^(ptb\.|canary\.)?discord(app)?\.com$/.test(u.hostname) && u.pathname.startsWith("/api/webhooks/")) return "discord";
  return "generic";
}

/** Returns an Indonesian error message, or null when the URL is usable. */
export function validateWebhookUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return "Isi URL webhook dulu.";
  let u: URL;
  try { u = new URL(url); } catch { return "Itu bukan URL. Salin URL lengkap yang dimulai dengan https://"; }
  // A webhook URL is a secret, so it only travels encrypted; plain http is allowed for a mock on this machine.
  if (u.protocol !== "https:" && !(u.protocol === "http:" && isLocal(u.hostname))) return "URL webhook harus diawali https:// (http:// hanya untuk mock di komputer ini).";
  if (u.hostname === "hooks.slack.com" && !u.pathname.startsWith("/services/")) return "URL Slack harus berbentuk https://hooks.slack.com/services/...";
  if (/discord(app)?\.com$/.test(u.hostname) && !u.pathname.startsWith("/api/webhooks/")) return "URL Discord harus berbentuk https://discord.com/api/webhooks/...";
  return null;
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

export async function postWebhook(url: string, payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (err) {
    throw new Error(`Webhook tidak bisa dihubungi: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`Webhook menjawab ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`.trim());
}

export const TEST_MESSAGE = "Pesan uji dari AI Production Cost Tracker\nKalau pesan ini muncul, budget alert akan dikirim ke channel ini.";
