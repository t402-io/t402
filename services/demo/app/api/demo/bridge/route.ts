import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
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
    await new Promise((r) => setTimeout(r, 800));
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle with facilitator
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = {
    scheme: "exact",
    network: getNetwork(),
    amount: BRIDGE_FEE,
    asset: getAsset(),
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: { name: "USDT", version: "2" },
  };

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
      { error: "Facilitator error", message: String(error) },
      { status: 502 }
    );
  }
}
