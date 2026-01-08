import { NextRequest, NextResponse } from "next/server";
import { withT402 } from "@t402/next";
import { declareDiscoveryExtension } from "@t402/extensions/bazaar";
import { server, EVM_PAYEE_ADDRESS, EVM_NETWORK } from "../../../proxy";

/**
 * Handler for the protected endpoint
 */
const handler = async (_: NextRequest) => {
  return NextResponse.json({
    message: "Protected endpoint accessed successfully (withT402)",
    timestamp: new Date().toISOString(),
  });
};

/**
 * Protected EVM endpoint using withT402 wrapper
 *
 */
export const GET = withT402(
  handler,
  {
    accepts: {
      payTo: EVM_PAYEE_ADDRESS,
      scheme: "exact",
      price: "$0.001",
      network: EVM_NETWORK,
    },
    extensions: {
      ...declareDiscoveryExtension({
        output: {
          example: {
            message: "Protected endpoint accessed successfully (withT402)",
            timestamp: "2024-01-01T00:00:00Z",
          },
          schema: {
            properties: {
              message: { type: "string" },
              timestamp: { type: "string" },
            },
            required: ["message", "timestamp"],
          },
        },
      }),
    },
  },
  server,
);

