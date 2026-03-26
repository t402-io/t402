import { NextRequest, NextResponse } from "next/server";
import { quoteBridge, getSupportedBridgeChains, supportsRealBridge } from "@/lib/bridge-executor";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fromChain, toChain, amount = "100000", recipient } = body;

  if (!fromChain || !toChain) {
    return NextResponse.json({ error: "fromChain and toChain required" }, { status: 400 });
  }

  if (fromChain === toChain) {
    return NextResponse.json({ error: "Source and target must be different" }, { status: 400 });
  }

  // Check if real bridge is available
  if (!supportsRealBridge(fromChain, toChain)) {
    return NextResponse.json({
      available: false,
      reason: "LayerZero OFT not available for this chain pair",
      supportedChains: getSupportedBridgeChains(),
      simulated: true,
      // Return estimated data for simulated bridges
      estimatedTime: 300,
      estimatedTimeFormatted: "~5 min",
      nativeFeeFormatted: "~0.001 ETH",
      amountToSend: amount,
      minAmountToReceive: String(Math.floor(parseInt(amount, 10) * 0.995)),
      fromChain,
      toChain,
      protocol: "LayerZero V2 (simulated)",
    });
  }

  // Get real quote
  const quote = await quoteBridge({
    fromChain,
    toChain,
    amount: BigInt(amount),
    recipient: recipient || "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
  });

  if (!quote) {
    return NextResponse.json({
      available: false,
      reason: "Bridge wallet not configured",
      supportedChains: getSupportedBridgeChains(),
    });
  }

  return NextResponse.json(quote);
}

export async function GET() {
  return NextResponse.json({
    supportedChains: getSupportedBridgeChains(),
    protocol: "LayerZero V2",
    token: "USDT0",
    t402Fee: "10000",
    t402FeeFormatted: "0.01 USDT",
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
