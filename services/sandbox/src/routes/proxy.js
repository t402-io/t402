/**
 * POST /verify and POST /settle routes — upstream proxy + magic addresses.
 */
import { randomUUID } from "node:crypto";
import { VERIFY_TIMEOUT_MS, SETTLE_TIMEOUT_MS } from "../lib/config.js";
import { log } from "../lib/logger.js";
import { validateNetwork, extractPayer, findMagicKey } from "../lib/magic.js";
import { incrementRequests, incrementUpstreamErrors } from "../lib/metrics.js";
import { proxyToFacilitator } from "../lib/upstream.js";

export function registerProxyRoutes(app) {
  app.post("/verify", async (req, res) => {
    incrementRequests();
    const network = req.body?.paymentRequirements?.network;
    const networkError = validateNetwork(network);
    if (networkError) {
      return res.status(400).json({
        isValid: false,
        invalidReason: networkError.error,
        ...(networkError.suggestion && { suggestion: networkError.suggestion }),
        sandbox: true,
      });
    }

    // Check for magic test addresses
    const payer = extractPayer(req.body);
    const magicKey = findMagicKey(payer);
    if (magicKey) {
      // Simulate latency for SLOW_RESPONSE
      if (magicKey === "SLOW_RESPONSE") {
        await new Promise(r => setTimeout(r, 2000));
      }

      if (magicKey === "VERIFY_SUCCESS" || magicKey === "SETTLE_SUCCESS") {
        return res.json({
          isValid: true,
          payer: payer,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated successful verification",
        });
      }
      if (magicKey === "VERIFY_FAIL_SIGNATURE") {
        return res.json({
          isValid: false,
          invalidReason: "invalid_signature",
          payer: payer,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated signature verification failure",
        });
      }
      if (magicKey === "VERIFY_FAIL_EXPIRED") {
        return res.json({
          isValid: false,
          invalidReason: "authorization_expired",
          payer: payer,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated expired authorization",
        });
      }
      // For settle-specific addresses, verify still succeeds (you'd verify before settling)
      if (magicKey === "SETTLE_FAIL_FUNDS" || magicKey === "SETTLE_FAIL_TIMEOUT") {
        return res.json({
          isValid: true,
          payer: payer,
          sandbox: true,
          mock: true,
          note: "Magic test address — verification passed (settle will fail with this address)",
        });
      }
      if (magicKey === "SLOW_RESPONSE") {
        return res.json({
          isValid: true,
          payer: payer,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated slow response (2s delay)",
        });
      }
    }

    try {
      const result = await proxyToFacilitator("/verify", req.body, VERIFY_TIMEOUT_MS);
      if (result.status >= 500) {
        throw new Error(`Upstream returned ${result.status}`);
      }
      res.status(result.status).json(result.data);
    } catch (err) {
      incrementUpstreamErrors();
      log("error", "/verify upstream error", { error: err.message });
      res.status(503).json({
        isValid: false,
        invalidReason: "Upstream facilitator unreachable — mock mode active. Responses are simulated, not verified on-chain.",
        sandbox: true,
        mock: true,
      });
    }
  });

  app.post("/settle", async (req, res) => {
    incrementRequests();
    const network = req.body?.paymentRequirements?.network;
    const networkError = validateNetwork(network);
    if (networkError) {
      return res.status(400).json({
        success: false,
        errorReason: networkError.error,
        ...(networkError.suggestion && { suggestion: networkError.suggestion }),
        sandbox: true,
      });
    }

    // Check for magic test addresses
    const settlerPayer = extractPayer(req.body);
    const settleMagicKey = findMagicKey(settlerPayer);
    if (settleMagicKey) {
      if (settleMagicKey === "SLOW_RESPONSE") {
        await new Promise(r => setTimeout(r, 2000));
      }

      const mockNetwork = network || "eip155:84532";
      const mockTxHash = "0x" + randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

      if (settleMagicKey === "VERIFY_SUCCESS"
        || settleMagicKey === "SETTLE_SUCCESS"
        || settleMagicKey === "SLOW_RESPONSE") {
        return res.json({
          success: true,
          payer: settlerPayer,
          transaction: mockTxHash,
          network: mockNetwork,
          confirmations: "confirmed",
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated successful settlement",
        });
      }
      if (settleMagicKey === "SETTLE_FAIL_FUNDS") {
        return res.json({
          success: false,
          errorReason: "insufficient_funds",
          payer: settlerPayer,
          network: mockNetwork,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated insufficient funds",
        });
      }
      if (settleMagicKey === "SETTLE_FAIL_TIMEOUT") {
        return res.json({
          success: false,
          errorReason: "settlement_timeout",
          payer: settlerPayer,
          network: mockNetwork,
          sandbox: true,
          mock: true,
          note: "Magic test address — simulated settlement timeout",
        });
      }
      // verify-specific fail addresses still settle (weird case, but handle gracefully)
      if (settleMagicKey === "VERIFY_FAIL_SIGNATURE"
        || settleMagicKey === "VERIFY_FAIL_EXPIRED") {
        return res.json({
          success: true,
          payer: settlerPayer,
          transaction: mockTxHash,
          network: mockNetwork,
          confirmations: "confirmed",
          sandbox: true,
          mock: true,
          note: "Magic test address — settlement succeeds (this address only fails verify)",
        });
      }
    }

    try {
      const result = await proxyToFacilitator("/settle", req.body, SETTLE_TIMEOUT_MS);
      if (result.status >= 500) {
        throw new Error(`Upstream returned ${result.status}`);
      }
      res.status(result.status).json(result.data);
    } catch (err) {
      incrementUpstreamErrors();
      log("error", "/settle upstream error", { error: err.message });
      res.status(503).json({
        success: false,
        errorReason: "Upstream facilitator unreachable — mock mode active. No on-chain settlement occurred.",
        payer: "0x0000000000000000000000000000000000000000",
        sandbox: true,
        mock: true,
      });
    }
  });
}
