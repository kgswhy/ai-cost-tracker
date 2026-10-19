import { describe, expect, it } from "vitest";
import { webhookSender, type BudgetAlert } from "../src/alerts/index";
import { buildPayload, detectProvider, maskWebhookUrl, validateWebhookUrl } from "../src/alerts/webhook";
import { openDatabase } from "../src/db/index";
import { deleteSetting, resolveWebhook, setSetting, WEBHOOK_KEY } from "../src/db/settings";

const SLACK = "https://hooks.slack.com/services/T0000/B0000/abcdefghijklmnop";
const DISCORD = "https://discord.com/api/webhooks/123456789/secret-token-x9Qa";
const alert: BudgetAlert = {
  projectCode: "INT-00", projectName: "Internal R&D", client: "Internal",
  thresholdPct: 80, spendIdr: 17_158_782, budgetIdr: 18_750_000, pctUsed: 91.5135,
};

describe("which tool a webhook URL belongs to", () => {
  it("recognises Slack and Discord, and treats anything else as generic", () => {
    expect(detectProvider(SLACK)).toBe("slack");
    expect(detectProvider(DISCORD)).toBe("discord");
    expect(detectProvider("https://discordapp.com/api/webhooks/1/x")).toBe("discord");
    expect(detectProvider("https://ptb.discord.com/api/webhooks/1/x")).toBe("discord");
    expect(detectProvider("http://localhost:4020/webhook")).toBe("generic");
    expect(detectProvider("not a url")).toBe("generic");
  });
});

describe("webhook URL checks", () => {
  it("accepts Slack, Discord, any https URL and a local http mock", () => {
    expect(validateWebhookUrl(SLACK)).toBeNull();
    expect(validateWebhookUrl(` ${DISCORD} `)).toBeNull();
    expect(validateWebhookUrl("https://example.com/hook")).toBeNull();
    expect(validateWebhookUrl("http://localhost:4020/webhook")).toBeNull();
  });
  it("rejects empty, malformed, plain-http and wrong-path URLs with a reason", () => {
    expect(validateWebhookUrl("")).toMatch(/Isi URL/);
    expect(validateWebhookUrl("hooks.slack.com/services/x")).toMatch(/bukan URL/);
    expect(validateWebhookUrl("http://example.com/hook")).toMatch(/https/);
    expect(validateWebhookUrl("https://hooks.slack.com/apps/x")).toMatch(/Slack/);
    expect(validateWebhookUrl("https://discord.com/channels/1/2")).toMatch(/Discord/);
  });
  it("masks the token so the page can show where alerts go without exposing it", () => {
    expect(maskWebhookUrl(SLACK)).toBe("hooks.slack.com/…/mnop");
    expect(maskWebhookUrl(DISCORD)).toBe("discord.com/…/x9Qa");
    expect(maskWebhookUrl(SLACK)).not.toContain("abcdefgh");
  });
});

describe("payload per tool", () => {
  const message = "Peringatan budget (80%): INT-00 Internal R&D (Internal)\nSpend saat ini: Rp 17.158.782";
  it("Slack gets only `text`, bold first line, with & < > escaped", () => {
    expect(buildPayload("slack", message, alert)).toEqual({
      text: "*Peringatan budget (80%): INT-00 Internal R&amp;D (Internal)*\nSpend saat ini: Rp 17.158.782",
    });
  });
  it("Discord gets `content` in bold markdown, a sender name, and no pings", () => {
    const p = buildPayload("discord", "Lewat budget (100%): *weird_name*\nBudget: Rp 1", alert);
    expect(p).toEqual({
      username: "AI Production Cost Tracker",
      content: "**Lewat budget (100%): \\*weird\\_name\\***\nBudget: Rp 1",
      allowed_mentions: { parse: [] },
    });
  });
  it("anything else gets both fields and the structured alert", () => {
    expect(buildPayload("generic", message, alert)).toEqual({ content: message, text: message, alert });
  });
});

describe("sending", () => {
  it("posts the Slack payload to a Slack URL and records the delivery as slack", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    expect(await webhookSender(SLACK, fetchImpl).send(alert)).toBe("slack");
    expect(calls[0].url).toBe(SLACK);
    expect(Object.keys(calls[0].body as object)).toEqual(["text"]);
    expect((calls[0].body as { text: string }).text).toContain("Budget terpakai: 91,5%");
  });
  it("turns a rejected request into a readable error", async () => {
    const fetchImpl = (async () => new Response("invalid_token", { status: 403 })) as unknown as typeof fetch;
    await expect(webhookSender(DISCORD, fetchImpl).send(alert)).rejects.toThrow(/403 invalid_token/);
  });
});

describe("where the URL comes from", () => {
  it("prefers the URL saved in the app, falls back to .env, and can be cleared", () => {
    const db = openDatabase(":memory:");
    expect(resolveWebhook(db, "")).toBeNull();
    expect(resolveWebhook(db, SLACK)).toEqual({ url: SLACK, origin: "env" });
    setSetting(db, WEBHOOK_KEY, DISCORD);
    expect(resolveWebhook(db, SLACK)).toEqual({ url: DISCORD, origin: "web" });
    deleteSetting(db, WEBHOOK_KEY);
    expect(resolveWebhook(db, SLACK)).toEqual({ url: SLACK, origin: "env" });
  });
});
