import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";


const RESOURCE = {
  url: "/api/demo/a2a-task",
  description: "Agent-to-agent task execution — pay per task with USDT",
};

function createA2aPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: { ...RESOURCE, mimeType: "application/json" },
    accepts: getAcceptsForChain(chain, DEMO_AMOUNT),
  };
}

const TASK_RESULTS: Record<string, string> = {
  research: "Bitcoin adoption has grown 40% YoY among institutional investors. Key drivers: ETF approvals, corporate treasury adoption, and payment infrastructure maturation. USDT remains the dominant trading pair with 70% market share.",
  summary: "DeFi TVL reached $180B in 2025, driven by RWA tokenization and cross-chain interoperability. T402-enabled micropayments are emerging as a key primitive for agent-to-agent commerce in DeFi protocols.",
  monitor: "Protocol health: All 9 supported networks operational. Average settlement time: 2.1s (EVM), 0.4s (Solana), 3.2s (TON). Facilitator uptime: 99.97% over 30 days. 12,847 settlements processed this week.",
};

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  let taskId = "research";
  try {
    const body = await request.json();
    if (body.task) taskId = body.task;
  } catch {
    // Use default
  }

  // If no payment header, return 402
  if (!paymentHeader) {
    const paymentRequired = createA2aPaymentRequired(request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Payment present — verify and execute task
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = {
    scheme: "exact",
    network: getNetwork(),
    amount: DEMO_AMOUNT,
    asset: getAsset(),
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    extra: { name: "USDT", version: "2" },
  };

  const taskResult = {
    id: "task-" + Date.now().toString(36),
    status: { state: "completed" },
    artifacts: [
      {
        kind: "text",
        parts: [{ kind: "text", text: TASK_RESULTS[taskId] || TASK_RESULTS.research }],
      },
    ],
  };

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 1200));
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(taskResult);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

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

    const response = NextResponse.json(taskResult);
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
