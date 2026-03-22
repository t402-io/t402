/**
 * POST /webhook/test route.
 */
import { randomUUID } from "node:crypto";
import { incrementRequests } from "../lib/metrics.js";

export function registerWebhookRoutes(app) {
  app.post("/webhook/test", async (req, res) => {
    incrementRequests();
    const { url, event } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing 'url' — provide the webhook URL to test", sandbox: true });
    }

    // Validate URL format and require HTTPS (except localhost for dev)
    try {
      const parsed = new URL(url);
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (!isLocalhost && parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Webhook URL must use HTTPS (localhost exempt for development)", sandbox: true });
      }
    } catch {
      return res.status(400).json({ error: "Invalid webhook URL format", sandbox: true });
    }

    const eventType = event || "verification.completed";
    const validEvents = ["verification.completed", "verification.failed", "settlement.completed", "settlement.failed"];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({
        error: `Invalid event type. Valid types: ${validEvents.join(", ")}`,
        sandbox: true,
      });
    }

    // Generate sample callback payload matching T402 webhook spec
    const timestamp = new Date().toISOString();
    const callbackId = randomUUID();
    const isSuccess = eventType.endsWith(".completed");
    const isVerify = eventType.startsWith("verification");

    const payload = {
      id: callbackId,
      event: eventType,
      timestamp,
      sandbox: true,
      data: isVerify
        ? {
            isValid: isSuccess,
            payer: "0x0000000000000000000000000000000000C0FFEE",
            network: "eip155:84532",
            ...(isSuccess ? {} : { invalidReason: "Simulated verification failure for testing" }),
          }
        : {
            success: isSuccess,
            transaction: isSuccess ? "0x" + "a".repeat(64) : undefined,
            network: "eip155:84532",
            payer: "0x0000000000000000000000000000000000C0FFEE",
            ...(isSuccess ? {} : { errorReason: "Simulated settlement failure for testing" }),
          },
    };

    // Compute HMAC signature (using a test secret)
    const { createHmac } = await import("node:crypto");
    const secret = "sandbox-webhook-test-secret";
    const signature = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");

    try {
      const callbackRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-T402-Signature": `sha256=${signature}`,
          "X-T402-Event": eventType,
          "X-T402-Delivery": callbackId,
          "User-Agent": "T402-Sandbox-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      res.json({
        delivered: true,
        callbackId,
        event: eventType,
        targetUrl: url,
        targetStatus: callbackRes.status,
        signatureSecret: secret,
        signatureHeader: "X-T402-Signature",
        sandbox: true,
        note: `Verify signature with: HMAC-SHA256(body, "${secret}")`,
      });
    } catch (err) {
      res.status(502).json({
        delivered: false,
        callbackId,
        event: eventType,
        targetUrl: url,
        error: err.message,
        sandbox: true,
      });
    }
  });
}
