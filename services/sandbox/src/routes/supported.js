/**
 * Supported networks, faucets, examples, test-addresses, errors routes.
 */
import { MAGIC_ADDRESSES, SUPPORTED_NETWORKS, SUPPORTED_KINDS } from "../lib/magic.js";
import { incrementRequests } from "../lib/metrics.js";
import { upstreamHealthy, upstreamNetworks, upstreamSigners } from "../lib/upstream.js";

export function registerSupportedRoutes(app) {
  app.get("/supported", (_req, res) => {
    incrementRequests();
    const kinds = SUPPORTED_KINDS.map(k => ({
      ...k,
      upstream: upstreamNetworks.includes(k.network),
    }));
    const defaultSigners = {
      "eip155:*": ["0xC88f67e776f16DcFBf42e6bDda1B82604448899B"],
      "solana:*": [],
      "ton:*": [],
      "tron:*": [],
      "stellar:*": [],
    };
    res.json({
      kinds,
      extensions: ["erc8004"],
      signers: upstreamSigners || defaultSigners,
      sandbox: true,
      upstreamHealthy: upstreamHealthy === true,
      hint: "Testnet only — networks with upstream:true have real on-chain verification. Others use mock fallback.",
    });
  });

  app.get("/faucets", (_req, res) => {
    incrementRequests();
    res.json({
      faucets: [
        { network: "eip155:84532", name: "Base Sepolia", tokens: [
          { symbol: "USDC", url: "https://portal.cdp.coinbase.com/products/faucet" },
          { symbol: "ETH (gas)", url: "https://portal.cdp.coinbase.com/products/faucet" },
        ]},
        { network: "eip155:11155111", name: "Ethereum Sepolia", tokens: [
          { symbol: "ETH (gas)", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
          { symbol: "USDC", url: "https://faucet.circle.com/" },
        ]},
        { network: "eip155:421614", name: "Arbitrum Sepolia", tokens: [
          { symbol: "ETH (gas)", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
          { symbol: "USDC", url: "https://faucet.circle.com/" },
        ]},
        { network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", name: "Solana Devnet", tokens: [
          { symbol: "SOL (gas)", url: "https://faucet.solana.com/" },
          { symbol: "USDC", url: "https://faucet.circle.com/" },
        ]},
        { network: "ton:testnet", name: "TON Testnet", tokens: [
          { symbol: "TON (gas)", url: "https://t.me/testgiver_ton_bot" },
          { symbol: "USDT", url: "https://t.me/testgiver_ton_bot", note: "Use magic test addresses for USDT testing" },
        ]},
        { network: "tron:nile", name: "TRON Nile", tokens: [
          { symbol: "TRX (gas)", url: "https://nileex.io/join/getJoinPage" },
        ]},
        { network: "stellar:testnet", name: "Stellar Testnet", tokens: [
          { symbol: "XLM (gas)", url: "https://friendbot.stellar.org" },
        ]},
      ],
      note: "For networks without token faucets, use magic test addresses (GET /test-addresses) for deterministic testing without real tokens.",
      sandbox: true,
    });
  });

  app.get("/test-addresses", (_req, res) => {
    incrementRequests();
    res.json({
      testAddresses: {
        verifySuccess: {
          address: MAGIC_ADDRESSES.VERIFY_SUCCESS,
          description: "Always passes verification",
          verify: "isValid: true",
          settle: "success: true",
        },
        verifyFailSignature: {
          address: MAGIC_ADDRESSES.VERIFY_FAIL_SIGNATURE,
          description: "Fails verification with invalid_signature",
          verify: "isValid: false, invalidReason: 'invalid_signature'",
          settle: "success: true (verify-only failure)",
        },
        verifyFailExpired: {
          address: MAGIC_ADDRESSES.VERIFY_FAIL_EXPIRED,
          description: "Fails verification with authorization_expired",
          verify: "isValid: false, invalidReason: 'authorization_expired'",
          settle: "success: true (verify-only failure)",
        },
        settleSuccess: {
          address: MAGIC_ADDRESSES.SETTLE_SUCCESS,
          description: "Always settles successfully",
          verify: "isValid: true",
          settle: "success: true",
        },
        settleFailFunds: {
          address: MAGIC_ADDRESSES.SETTLE_FAIL_FUNDS,
          description: "Fails settlement with insufficient_funds",
          verify: "isValid: true",
          settle: "success: false, errorReason: 'insufficient_funds'",
        },
        settleFailTimeout: {
          address: MAGIC_ADDRESSES.SETTLE_FAIL_TIMEOUT,
          description: "Fails settlement with settlement_timeout",
          verify: "isValid: true",
          settle: "success: false, errorReason: 'settlement_timeout'",
        },
        slowResponse: {
          address: MAGIC_ADDRESSES.SLOW_RESPONSE,
          description: "Adds 2-second delay to response (for timeout testing)",
          verify: "isValid: true (after 2s delay)",
          settle: "success: true (after 2s delay)",
        },
      },
      usage: "Include any test address as the 'payer' field in paymentPayload.payload.payer, paymentPayload.authorization.payer, or paymentPayload.payer",
      sandbox: true,
    });
  });

  app.get("/examples", (_req, res) => {
    incrementRequests();

    // Example PaymentRequirements matching SDK PaymentRequirements type
    const exampleRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "1000000",
      payTo: "0xRecipientAddress",
      maxTimeoutSeconds: 300,
      extra: {},
    };

    // Example PaymentPayload matching SDK PaymentPayload type
    const examplePayload = {
      t402Version: 2,
      accepted: exampleRequirements,
      payload: {
        payer: MAGIC_ADDRESSES.VERIFY_SUCCESS,
        signature: "0xabc123...",
      },
    };

    // Example verify/settle request body (matches SDK VerifyRequest/SettleRequest)
    const exampleVerifyBody = {
      paymentPayload: examplePayload,
      paymentRequirements: exampleRequirements,
    };

    res.json({
      note: "All examples use magic test addresses (0x...CAFE01) for deterministic responses. See GET /test-addresses for the full list.",
      verify: {
        request: {
          method: "POST",
          url: "https://sandbox.t402.io/verify",
          headers: { "Content-Type": "application/json" },
          body: exampleVerifyBody,
        },
        response: { isValid: true, payer: MAGIC_ADDRESSES.VERIFY_SUCCESS, sandbox: true, mock: true },
      },
      settle: {
        request: {
          method: "POST",
          url: "https://sandbox.t402.io/settle",
          headers: { "Content-Type": "application/json" },
          body: exampleVerifyBody,
        },
        response: {
          success: true,
          transaction: "0x" + "a".repeat(64),
          network: "eip155:84532",
          payer: MAGIC_ADDRESSES.VERIFY_SUCCESS,
          confirmations: "confirmed",
          sandbox: true,
          mock: true,
        },
      },
      webhook: {
        request: {
          method: "POST",
          url: "https://sandbox.t402.io/webhook/test",
          headers: { "Content-Type": "application/json" },
          body: {
            url: "https://your-server.com/webhook",
            event: "settlement.completed",
          },
        },
        response: {
          delivered: true,
          callbackId: "uuid",
          event: "settlement.completed",
          targetUrl: "https://your-server.com/webhook",
          targetStatus: 200,
          signatureSecret: "sandbox-webhook-test-secret",
        },
        events: ["verification.completed", "verification.failed", "settlement.completed", "settlement.failed"],
      },
      testAddresses: {
        description: "Magic test addresses simulate deterministic verify/settle outcomes without real tokens (like Stripe's test card numbers)",
        example: {
          method: "POST",
          url: "https://sandbox.t402.io/verify",
          headers: { "Content-Type": "application/json" },
          body: exampleVerifyBody,
        },
        addresses: MAGIC_ADDRESSES,
        listEndpoint: "GET /test-addresses",
      },
      curl: {
        supported: "curl -s https://sandbox.t402.io/supported | jq",
        faucets: "curl -s https://sandbox.t402.io/faucets | jq",
        testAddresses: "curl -s https://sandbox.t402.io/test-addresses | jq",
        verify: `curl -s -X POST https://sandbox.t402.io/verify -H "Content-Type: application/json" -d '${JSON.stringify(exampleVerifyBody)}'`,
      },
      openapi: "GET /openapi.yaml",
      sandbox: true,
    });
  });

  app.get("/errors", (_req, res) => {
    incrementRequests();
    res.json({
      errors: [
        {
          status: 400,
          code: "missing_network",
          message: "Missing or invalid paymentRequirements.network",
          cause: "The request body is missing the paymentRequirements.network field, or it's not a string",
          fix: "Include a valid testnet network from /supported in your request body",
          example: { paymentRequirements: { network: "eip155:84532" } },
        },
        {
          status: 400,
          code: "unsupported_network",
          message: `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`,
          cause: "The network you specified is not a supported testnet",
          fix: "Use one of the networks listed at GET /supported. Mainnet networks are not allowed.",
        },
        {
          status: 400,
          code: "invalid_json",
          message: "Invalid JSON",
          cause: "The request body is not valid JSON",
          fix: "Ensure Content-Type is application/json and the body is valid JSON",
        },
        {
          status: 400,
          code: "missing_webhook_url",
          message: "Missing 'url' — provide the webhook URL to test",
          cause: "POST /webhook/test requires a 'url' field",
          fix: "Include { \"url\": \"https://your-server.com/webhook\" } in the body",
        },
        {
          status: 400,
          code: "invalid_webhook_url",
          message: "Webhook URL must use HTTPS",
          cause: "Non-localhost webhook URLs must use HTTPS for security",
          fix: "Use an HTTPS URL, or localhost/127.0.0.1 for development",
        },
        {
          status: 400,
          code: "invalid_event_type",
          message: "Invalid event type",
          cause: "The event field is not a recognized T402 webhook event",
          fix: "Use one of: verification.completed, verification.failed, settlement.completed, settlement.failed",
        },
        {
          status: 415,
          code: "wrong_content_type",
          message: "Content-Type must be application/json",
          cause: "POST requests must have Content-Type: application/json header",
          fix: "Add -H 'Content-Type: application/json' to your curl command",
        },
        {
          status: 429,
          code: "rate_limit_exceeded",
          message: "Rate limit exceeded",
          cause: "You've exceeded 100 requests/minute from your IP",
          fix: "Wait for the rate limit window to reset (1 minute). Check X-RateLimit-Remaining header.",
        },
        {
          status: 502,
          code: "webhook_delivery_failed",
          message: "Webhook delivery failed",
          cause: "The target webhook URL was unreachable or returned an error",
          fix: "Ensure your webhook server is running and accessible",
        },
        {
          status: 503,
          code: "upstream_unreachable",
          message: "Upstream facilitator unreachable — mock mode active",
          cause: "The sandbox cannot reach the upstream facilitator for real verification/settlement",
          fix: "Use magic test addresses (GET /test-addresses) for deterministic responses, or wait for upstream to recover (check GET /ready)",
        },
      ],
      sandbox: true,
    });
  });
}
