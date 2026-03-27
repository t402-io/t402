import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment, recordSettlement, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { getBtcPrice } from "@/lib/price-service";
import { generateMarketDisplayData } from "@/lib/content-generator";
import { classifyFacilitatorError } from "@/lib/error-helpers";


const RESOURCE = {
  url: "/api/demo/market-data",
  description: "Premium real-time market data feed",
};

export async function GET(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  // If no payment header, return 402
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

  // Payment header present — verify and settle
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, DEMO_AMOUNT);

  if (isDemoMode) {
    // Demo mode: simulate verify + settle, but use real prices
    await new Promise((r) => setTimeout(r, 800));
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);

    // Fetch real price data from CoinGecko
    const priceData = await getBtcPrice();
    const marketData = { data: generateMarketDisplayData(priceData) };

    const response = NextResponse.json(marketData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: call real facilitator
  try {
    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/market-data", description: "Market Data" });
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
          metadata: { source: "demo.t402.io/market-data", description: "Market Data", preBroadcast: true },
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
      settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/market-data", description: "Market Data" });
      if (!settleResult?.success) {
        return NextResponse.json(
          { error: "Settlement failed", reason: settleResult?.errorReason },
          { status: 500 }
        );
      }
    }

    // Fetch real price data from CoinGecko
    const priceData = await getBtcPrice();
    const marketData = { data: generateMarketDisplayData(priceData) };

    const response = NextResponse.json(marketData);
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
