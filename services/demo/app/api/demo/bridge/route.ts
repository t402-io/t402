import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain } from "@/lib/config";
import { encodeHeader } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";

const BRIDGE_FEE = "10000"; // 0.01 USDT bridge fee

function createPaymentRequired(sourceChain: string, targetChain: string, request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/bridge",
      description: `Cross-chain bridge: ${sourceChain} → ${targetChain}`,
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, BRIDGE_FEE),
  };
}

export async function POST(request: NextRequest) {
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const body = await request.json().catch(() => ({}));
  const { sourceChain = "evm", targetChain = "ton", amount = "1000000" } = body;

  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(sourceChain, targetChain, request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const chain = getPreferredChain(request);
  const txHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");

  const responseData = {
    success: true,
    bridge: {
      sourceChain,
      targetChain,
      amount,
      fee: BRIDGE_FEE,
      txHash,
      status: "confirmed",
      protocol: "LayerZero",
    },
  };

  if (isDemoMode) {
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  return NextResponse.json(responseData);
}
