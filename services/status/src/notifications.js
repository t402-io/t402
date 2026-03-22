/**
 * Webhook notifications for status changes.
 *
 * Configure via WEBHOOK_URLS env var (comma-separated).
 * Supports Discord, Slack, Telegram, and generic JSON webhooks.
 * Per-service cooldown prevents notification storms from flapping services.
 */

const WEBHOOK_URLS = (process.env.WEBHOOK_URLS || "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];
const COOLDOWN_MS = 300_000; // 5 minutes per-service cooldown

// Per-service notification tracking
const lastNotified = new Map(); // serviceId → timestamp
const lastEvent = new Map();    // serviceId → status ("down"/"degraded"/"operational")

function formatPayload(event, url) {
  const isDown = event.to === "down" || event.to === "degraded";
  const emoji = isDown ? "\u{1F534}" : "\u{1F7E2}"; // red/green circle
  const title = isDown
    ? `${event.serviceName} is ${event.to}`
    : `${event.serviceName} recovered`;
  const description = isDown
    ? `Service transitioned from ${event.from} to ${event.to}`
    : `Service is back to operational`;
  const color = isDown ? 0xef4444 : 0x50af95;
  const timestamp = new Date().toISOString();

  // Discord webhook format
  if (url.includes("discord.com/api/webhooks")) {
    return {
      url,
      body: {
        embeds: [{
          title: `${emoji} ${title}`,
          description,
          color,
          timestamp,
          footer: { text: "T402 Status" },
        }],
      },
    };
  }

  // Slack webhook format
  if (url.includes("hooks.slack.com")) {
    return {
      url,
      body: {
        text: `${emoji} *${title}*`,
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${title}*\n${description}\n_${timestamp}_`,
          },
        }],
      },
    };
  }

  // Telegram webhook format
  if (url.includes("api.telegram.org")) {
    const parsed = new URL(url);
    const chatId = parsed.searchParams.get("chat_id");
    // Remove query params for the POST URL
    const postUrl = `${parsed.origin}${parsed.pathname}`;
    return {
      url: postUrl,
      body: {
        chat_id: chatId,
        text: `${emoji} <b>${title}</b>\n${description}\n<i>${timestamp}</i>`,
        parse_mode: "HTML",
      },
    };
  }

  // Generic JSON payload
  return {
    url,
    body: {
      event: isDown ? "service.down" : "service.recovered",
      service: { id: event.serviceId, name: event.serviceName },
      from: event.from,
      to: event.to,
      timestamp,
      statusPageUrl: "https://status.t402.io",
    },
  };
}

async function sendWithRetry(url, payload, attempt = 0) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "T402-StatusNotifier/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Drain response body before retry
      await res.text().catch(() => {});
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        return sendWithRetry(url, payload, attempt + 1);
      }
    } else {
      const host = new URL(url).hostname;
      console.log(`Webhook delivered: ${host}`);
    }
  } catch (e) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(url, payload, attempt + 1);
    }
    console.error(`Webhook failed after ${MAX_RETRIES} attempts: ${new URL(url).hostname}`, e.message);
  }
}

export async function notifyStatusChange(event) {
  if (WEBHOOK_URLS.length === 0) return;

  // Per-service cooldown
  const now = Date.now();
  const lastTime = lastNotified.get(event.serviceId) || 0;
  if (now - lastTime < COOLDOWN_MS) return;

  // Dedup — skip if same status as last notification for this service
  const lastStatus = lastEvent.get(event.serviceId);
  if (lastStatus === event.to) return;

  // Update tracking
  lastNotified.set(event.serviceId, now);
  lastEvent.set(event.serviceId, event.to);

  const tasks = WEBHOOK_URLS.map((rawUrl) => {
    const { url, body } = formatPayload(event, rawUrl);
    return sendWithRetry(url, body);
  });
  // Fire and forget — don't block the check cycle
  Promise.allSettled(tasks).catch(() => {});
}
