import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain } from "@/lib/config";
import { encodeHeader } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";

const STREAM_MAX_AMOUNT = "10000"; // 0.01 USDT max (upto scheme)

function createPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: "/api/demo/stream",
      description: "Premium audio stream - pay per 10 seconds",
      mimeType: "audio/stream",
    },
    accepts: getAcceptsForChain(chain, STREAM_MAX_AMOUNT, "upto"),
  };
}

export async function GET(request: NextRequest) {
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";

  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const segment = request.nextUrl.searchParams.get("segment") || "0";
  const segmentNum = parseInt(segment);

  const responseData = {
    segment: segmentNum,
    duration: 10,
    format: "audio/mp3",
    bitrate: 320,
    cost: "0.001",
    data: `[audio-data-segment-${segment}]`,
  };

  if (isDemoMode) {
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json(responseData);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  return NextResponse.json(responseData);
}
