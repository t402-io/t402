import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, t402ResourceServer } from "@t402/express";
import { ExactTronScheme } from "@t402/tron/exact/server";
import { HTTPFacilitatorClient } from "@t402/core/server";

config();

const tronAddress = process.env.TRON_ADDRESS;
if (!tronAddress) {
  console.error("❌ TRON_ADDRESS environment variable is required");
  console.error("   Example: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (your TRON wallet address)");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL;
if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  console.error("   Example: https://facilitator.t402.io");
  process.exit(1);
}

const network = process.env.TRON_NETWORK || "tron:nile";
const port = process.env.PORT || 4021;

console.log("🚀 Starting TRON t402 server...");
console.log(`   TRON Address: ${tronAddress}`);
console.log(`   Network: ${network}`);
console.log(`   Facilitator: ${facilitatorUrl}`);

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

const app = express();

/**
 * Configure t402 payment middleware with TRON support
 *
 * This middleware protects specific routes with TRON TRC20 USDT payment requirements.
 * When a client accesses a protected route without payment, they receive
 * a 402 Payment Required response with TRON payment details.
 *
 * The payment flow:
 * 1. Client receives PaymentRequired with TRON network and USDT asset
 * 2. Client creates and signs a TRC20 transfer transaction
 * 3. Client sends the signed transaction in the PAYMENT-SIGNATURE header
 * 4. Server verifies via facilitator and serves the resource
 */
app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: network,
            payTo: tronAddress,
          },
        ],
        description: "Weather data",
        mimeType: "application/json",
      },
      "GET /premium": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: network,
            payTo: tronAddress,
          },
        ],
        description: "Premium content",
        mimeType: "application/json",
      },
    },
    new t402ResourceServer(facilitatorClient).register(network, new ExactTronScheme()),
  ),
);

/**
 * Protected endpoint - requires $0.001 USDT payment on TRON
 */
app.get("/weather", (req, res) => {
  const city = (req.query.city as string) || "San Francisco";

  const weatherData: Record<string, { weather: string; temperature: number }> = {
    "San Francisco": { weather: "foggy", temperature: 60 },
    "New York": { weather: "cloudy", temperature: 55 },
    London: { weather: "rainy", temperature: 50 },
    Tokyo: { weather: "clear", temperature: 65 },
  };

  const data = weatherData[city] || { weather: "sunny", temperature: 70 };

  res.json({
    city,
    ...data,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Protected endpoint - requires $0.01 USDT payment on TRON
 */
app.get("/premium", (req, res) => {
  res.json({
    content: "This is premium content protected by TRON TRC20 USDT payments",
    features: ["Advanced analytics", "Priority support", "Extended history"],
    timestamp: new Date().toISOString(),
  });
});

/**
 * Health check endpoint - no payment required
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    network: network,
    version: "1.0.0",
  });
});

app.listen(port, () => {
  console.log(`   Server listening on http://localhost:${port}\n`);
  console.log("Endpoints:");
  console.log(`   GET /weather - $0.001 USDT (${network})`);
  console.log(`   GET /premium - $0.01 USDT (${network})`);
  console.log("   GET /health  - Free");
});
