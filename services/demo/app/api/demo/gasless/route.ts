import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";

const GASLESS_AMOUNT = "1000"; // 0.001 USDT

// ERC-4337 infrastructure configuration from environment
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://api.pimlico.io/v2/base-sepolia/rpc";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "https://api.pimlico.io/v2/base-sepolia/rpc";
const PAYMASTER_ADDRESS = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS || "0x0000000000000000000000000000000000000000";

function createPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/gasless",
      description: "Gasless USDT payment via ERC-4337",
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, GASLESS_AMOUNT).map((accept) => ({
      ...accept,
      extra: {
        gasless: true,
        paymaster: PAYMASTER_ADDRESS,
        paymasterUrl: PAYMASTER_URL,
        bundler: BUNDLER_URL,
      },
    })),
  };
}

export async function POST(request: NextRequest) {
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";

  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const chain = getPreferredChain(request);
  const txHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");

  const responseData = {
    success: true,
    gasless: true,
    userOperation: {
      sender: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68",
      nonce: "0x01",
      callData: "0xTransferCall",
      paymasterAndData: "0xPaymasterData",
    },
    settlement: {
      txHash,
      gasUsed: "0",
      gasPaidBy: "paymaster",
    },
  };

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 600));
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
    amount: GASLESS_AMOUNT,
    asset: getAsset(),
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: {
      name: "USDT",
      version: "2",
      gasless: true,
      paymaster: PAYMASTER_ADDRESS,
    },
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
