/**
 * Webhook notifications for status changes.
 *
 * Configure via WEBHOOK_URLS env var (comma-separated).
 * Supports Discord, Slack, and generic JSON webhooks.
 */

const WEBHOOK_URLS = (process.env.WEBHOOK_URLS || "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

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
      embeds: [
        {
          title: `${emoji} ${title}`,
          description,
          color,
          timestamp,
          footer: { text: "T402 Status" },
        },
      ],
    };
  }

  // Slack webhook format
  if (url.includes("hooks.slack.com")) {
    return {
      text: `${emoji} *${title}*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${title}*\n${description}\n_${timestamp}_`,
          },
        },
      ],
    };
  }

  // Generic JSON payload
  return {
    event: isDown ? "service.down" : "service.recovered",
    service: { id: event.serviceId, name: event.serviceName },
    from: event.from,
    to: event.to,
    timestamp,
    statusPageUrl: "https://status.t402.io",
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
    if (!res.ok && attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(url, payload, attempt + 1);
    }
  } catch (e) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(url, payload, attempt + 1);
    }
    console.error(`Webhook failed after ${MAX_RETRIES} attempts: ${url}`, e.message);
  }
}

export async function notifyStatusChange(event) {
  if (WEBHOOK_URLS.length === 0) return;
  const tasks = WEBHOOK_URLS.map((url) => {
    const payload = formatPayload(event, url);
    return sendWithRetry(url, payload);
  });
  // Fire and forget — don't block the check cycle
  Promise.allSettled(tasks).catch(() => {});
}
