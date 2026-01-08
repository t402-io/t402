import { paymentProxy } from "@t402/next";
import { t402ResourceServer, HTTPFacilitatorClient } from "@t402/core/server";
import { registerExactEvmScheme } from "@t402/evm/exact/server";
import { registerExactSvmScheme } from "@t402/svm/exact/server";
import { createPaywall } from "@t402/paywall";
import { evmPaywall } from "@t402/paywall/evm";
import { svmPaywall } from "@t402/paywall/svm";
import { declareDiscoveryExtension } from "@t402/extensions/bazaar";

const facilitatorUrl = process.env.FACILITATOR_URL;
export const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
export const svmAddress = process.env.SVM_ADDRESS;

if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}

if (!evmAddress || !svmAddress) {
  console.error("❌ EVM_ADDRESS and SVM_ADDRESS environment variables are required");
  process.exit(1);
}

// Create HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Create t402 resource server
export const server = new t402ResourceServer(facilitatorClient);

// Register schemes
registerExactEvmScheme(server);
registerExactSvmScheme(server);

// Build paywall
export const paywall = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .withConfig({
    appName: process.env.APP_NAME || "Next t402 Demo",
    appLogo: process.env.APP_LOGO || "/t402-icon-blue.png",
    testnet: true,
  })
  .build();

// Build proxy
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: "eip155:84532", // base-sepolia
          payTo: evmAddress,
        },
        {
          scheme: "exact",
          price: "$0.001",
          network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // solana devnet
          payTo: svmAddress,
        },
      ],
      description: "Premium music: t402 Remix",
      mimeType: "text/html",
      extensions: {
        ...declareDiscoveryExtension({}),
      },
    },
  },
  server,
  undefined, // paywallConfig (using custom paywall instead)
  paywall, // custom paywall provider
);

// Configure which paths the proxy should run on
export const config = {
  matcher: ["/protected/:path*"],
};
