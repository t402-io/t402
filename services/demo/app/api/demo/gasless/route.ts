import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload, getAsset, PAY_TO } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import {
  buildUserOperation,
  generateGasEstimates,
  calculateGasSavings,
  generateUserOpHash,
  ENTRYPOINT_V07,
  PIMLICO_PAYMASTER,
} from "@/lib/erc4337";
import type { Address } from "viem";

const GASLESS_AMOUNT = "1000"; // 0.001 USDT

// ERC-4337 infrastructure configuration
const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || "https://api.pimlico.io/v2/base-sepolia/rpc";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "https://api.pimlico.io/v2/base-sepolia/rpc";

function createPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/gasless",
      description: "Gasless USDT payment via ERC-4337 Account Abstraction",
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, GASLESS_AMOUNT, request).map((accept) => ({
      ...accept,
      extra: {
        gasless: true,
        accountAbstraction: "ERC-4337",
        entryPoint: ENTRYPOINT_V07,
        paymaster: PIMLICO_PAYMASTER,
        paymasterUrl: PAYMASTER_URL,
        bundlerUrl: BUNDLER_URL,
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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Extract sender from payment or use demo address
  const senderAddress = (body.sender || "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68") as Address;
  const tokenAddress = getAsset() as Address;
  const recipientAddress = PAY_TO as Address;
  const amount = BigInt(GASLESS_AMOUNT);

  // Build realistic UserOperation
  const userOperation = buildUserOperation({
    sender: senderAddress,
    tokenAddress,
    to: recipientAddress,
    amount,
    isDeployed: true,
  });

  // Generate gas estimates and savings
  const gasEstimates = generateGasEstimates();
  const gasSavings = calculateGasSavings(gasEstimates);
  const userOpHash = generateUserOpHash();

  const responseData = {
    success: true,
    gasless: true,
    accountAbstraction: {
      standard: "ERC-4337",
      entryPoint: ENTRYPOINT_V07,
      bundler: "Pimlico",
    },
    userOperation: {
      hash: userOpHash,
      sender: userOperation.sender,
      nonce: userOperation.nonce,
      callData: userOperation.callData,
      callGasLimit: userOperation.callGasLimit,
      verificationGasLimit: userOperation.verificationGasLimit,
      preVerificationGas: userOperation.preVerificationGas,
      maxFeePerGas: userOperation.maxFeePerGas,
      maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas,
      paymasterAndData: userOperation.paymasterAndData.slice(0, 82) + "...", // Truncate for display
    },
    sponsorship: {
      sponsored: true,
      paymaster: PIMLICO_PAYMASTER,
      gasSaved: gasSavings.savingsUsd,
      gasSavedWei: gasSavings.savings.toString(),
    },
    settlement: {
      userOpHash,
      txHash: null as string | null, // Will be set after bundler submission
      status: "bundled",
    },
  };

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 800)); // Simulate bundler delay
    const settleResponse = createMockSettleResponse(chain);

    // Add mock txHash
    responseData.settlement.txHash = settleResponse.transaction || null;
    responseData.settlement.status = "confirmed";

    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle with facilitator
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, GASLESS_AMOUNT);

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

    responseData.settlement.txHash = settleResult.transaction || null;
    responseData.settlement.status = "confirmed";

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
 * GET /api/demo/gasless - Get gasless payment info
 */
export async function GET() {
  const gasEstimates = generateGasEstimates();
  const gasSavings = calculateGasSavings(gasEstimates);

  return NextResponse.json({
    gasless: true,
    standard: "ERC-4337",
    entryPoint: ENTRYPOINT_V07,
    paymaster: PIMLICO_PAYMASTER,
    bundlerUrl: BUNDLER_URL,
    supportedChains: ["base-sepolia", "arbitrum-sepolia"],
    estimatedGasSavings: {
      wei: gasSavings.savings.toString(),
      usd: gasSavings.savingsUsd,
    },
    benefits: [
      "No ETH required for gas",
      "Pay only with USDT",
      "Paymaster sponsors transaction fees",
      "Same security as regular transactions",
    ],
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
