import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment, recordSettlement, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { getBtcPrice } from "@/lib/price-service";
import { generateAiMarketAnalysis } from "@/lib/content-generator";
import { classifyFacilitatorError } from "@/lib/error-helpers";


const RESOURCE = {
  url: "/api/demo/premium-report",
  description: "Premium market research report",
};

export async function GET(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  if (!paymentHeader) {
    const chain = getPreferredChain(request);
    const paymentRequired = {
      t402Version: 2,
      error: "Payment required",
      resource: { ...RESOURCE, mimeType: "application/json" },
      accepts: getAcceptsForChain(chain, DEMO_AMOUNT, request),
    };
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, DEMO_AMOUNT);

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 800));
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);

    // Generate dynamic report based on real price data
    const priceData = await getBtcPrice();
    const premiumReport = await generateAiMarketAnalysis(priceData);

    const response = NextResponse.json(premiumReport);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  try {
    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/premium-report", description: "Premium Report" });
      } catch { /* pre-broadcast: tx already on-chain */ }
      if (!settleResult) {
        const txHash = (paymentPayload as any)?.payload?.bocHash || (paymentPayload as any)?.payload?.txId || "pre-broadcast";
        const payer = (paymentPayload as any)?.payload?.authorization?.from || (paymentPayload as any)?.payload?.from || "unknown";
        settleResult = {
          success: true,
          transaction: txHash,
          network: requirements.network,
          payer,
        };
        // Record pre-broadcast settlement for Explorer visibility
        recordSettlement({
          network: requirements.network,
          scheme: requirements.scheme,
          txHash,
          fromAddress: payer,
          toAddress: requirements.payTo || "",
          amount: requirements.amount || "",
          asset: requirements.asset || "",
          metadata: { source: "demo.t402.io/premium-report", description: "Premium Report", preBroadcast: true },
        });
      }
    } else {
      const verifyResult = await verifyPayment(paymentPayload, requirements);
      if (!verifyResult.isValid) {
        return NextResponse.json(
          { error: "Payment verification failed", reason: verifyResult.invalidReason },
          { status: 402 }
        );
      }
      settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/premium-report", description: "Premium Report" });
      if (!settleResult?.success) {
        return NextResponse.json(
          { error: "Settlement failed", reason: settleResult?.errorReason },
          { status: 500 }
        );
      }
    }

    // Generate dynamic report based on real price data
    const priceData = await getBtcPrice();
    const premiumReport = await generateAiMarketAnalysis(priceData);

    const response = NextResponse.json(premiumReport);
    response.headers.set("Payment-Response", encodeHeader(settleResult));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  } catch (error) {
    const { status, error: errMsg, detail, requestId } = classifyFacilitatorError(error);
    return NextResponse.json(
      { error: errMsg, reason: detail, requestId },
      { status }
    );
  }
}

// Support OPTIONS for CORS preflight
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
