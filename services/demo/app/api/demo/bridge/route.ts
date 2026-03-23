import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload, PAY_TO } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { createBridgeTransaction, getEstimatedTimeRemaining } from "@/lib/bridge-state";

const BRIDGE_FEE = "10000"; // 0.01 USDT bridge fee

// Supported bridge chain families (matching frontend ChainFamily values)
const BRIDGE_CHAINS = ["evm", "ton", "tron", "solana", "stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

// Estimated bridge times in seconds
const ESTIMATED_TIMES: Record<string, Record<string, number>> = {
  ethereum: { arbitrum: 180, base: 180, optimism: 180, ink: 300, berachain: 300, unichain: 300 },
  arbitrum: { ethereum: 900, base: 300, optimism: 300, ink: 300, berachain: 300, unichain: 300 },
  base: { ethereum: 900, arbitrum: 300, optimism: 300, ink: 300, berachain: 300, unichain: 300 },
};

function getEstimatedBridgeTime(source: string, target: string): number {
  return ESTIMATED_TIMES[source]?.[target] ?? 300; // Default 5 minutes
}

function createPaymentRequired(sourceChain: string, targetChain: string, request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/bridge",
      description: `Cross-chain USDT0 bridge: ${sourceChain} → ${targetChain} (LayerZero OFT)`,
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, BRIDGE_FEE, request),
  };
}

export async function POST(request: NextRequest) {
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const {
    sourceChain = "arbitrum",
    targetChain = "ethereum",
    amount = "1000000",
    recipient,
  } = body;

  // Validate chains
  if (!BRIDGE_CHAINS.includes(sourceChain) || !BRIDGE_CHAINS.includes(targetChain)) {
    return NextResponse.json(
      {
        error: "Unsupported chain",
        reason: `Supported chains: ${BRIDGE_CHAINS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (sourceChain === targetChain) {
    return NextResponse.json(
      { error: "Source and target chains must be different" },
      { status: 400 }
    );
  }

  // No payment - return 402
  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(sourceChain, targetChain, request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const chain = getPreferredChain(request);
  const estimatedTime = getEstimatedBridgeTime(sourceChain, targetChain);

  // Create bridge transaction with tracking
  const bridgeState = createBridgeTransaction({
    sourceChain,
    targetChain,
    amount,
    fee: BRIDGE_FEE,
    recipient: recipient || PAY_TO,
  });

  const responseData = {
    success: true,
    bridge: {
      sourceChain,
      targetChain,
      amount,
      fee: BRIDGE_FEE,
      protocol: "LayerZero",
      version: "v2",
    },
    message: {
      guid: bridgeState.guid,
      srcTxHash: bridgeState.srcTxHash,
      status: bridgeState.status,
      estimatedTime,
      estimatedTimeRemaining: getEstimatedTimeRemaining(bridgeState),
    },
    tracking: {
      statusUrl: `/api/demo/bridge/status?guid=${bridgeState.guid}`,
      layerZeroScan: `https://scan.layerzero-api.com/v1/messages/${bridgeState.guid}`,
    },
  };

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 500)); // Simulate processing
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle with facilitator
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, BRIDGE_FEE);

  try {
    const verifyResult = await verifyPayment(paymentPayload, requirements);
    if (!verifyResult.isValid) {
      return NextResponse.json(
        { error: "Payment verification failed", reason: verifyResult.invalidReason },
        { status: 402 }
      );
    }

    const settleResult = await settlePayment(paymentPayload, requirements);
    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Settlement failed", reason: settleResult.errorReason },
        { status: 500 }
      );
    }

    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResult));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Facilitator error", reason: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/demo/bridge - Get supported chains and routes
 */
export async function GET() {
  return NextResponse.json({
    supportedChains: BRIDGE_CHAINS,
    protocol: "LayerZero",
    token: "USDT0",
    fee: BRIDGE_FEE,
    feeFormatted: "0.01 USDT",
    routes: BRIDGE_CHAINS.flatMap((source) =>
      BRIDGE_CHAINS.filter((target) => target !== source).map((target) => ({
        source,
        target,
        estimatedTime: getEstimatedBridgeTime(source, target),
        available: true,
      }))
    ),
  });
}

/**
 * Support CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Payment-Signature, x-preferred-chain, x-demo-mode, x-network-mode, x-preferred-network",
      "Access-Control-Expose-Headers": "Payment-Required, Payment-Response",
    },
  });
}
