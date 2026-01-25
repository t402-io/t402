import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { getBtcPrice } from "@/lib/price-service";
import { generateMarketDisplayData } from "@/lib/content-generator";

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
      accepts: getAcceptsForChain(chain, DEMO_AMOUNT),
    };

    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Payment header present — verify and settle
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

    // Fetch real price data from CoinGecko
    const priceData = await getBtcPrice();
    const marketData = { data: generateMarketDisplayData(priceData) };

    const response = NextResponse.json(marketData);
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
