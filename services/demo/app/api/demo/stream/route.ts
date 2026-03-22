import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, getAsset, PAY_TO } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { generateSegmentAudio, getSegmentInfo } from "@/lib/audio-generator";

const STREAM_MAX_AMOUNT = "10000"; // 0.01 USDT max (upto scheme)
const COST_PER_SEGMENT = "1000"; // 0.001 USDT per 10-second segment

function createPaymentRequired(request: NextRequest, segment: number) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: `/api/demo/stream?segment=${segment}`,
      description: `Premium audio stream - Segment ${segment} (10 seconds)`,
      mimeType: "audio/wav",
    },
    accepts: getAcceptsForChain(chain, STREAM_MAX_AMOUNT, "upto"),
  };
}

// GET /api/demo/stream?segment=0&format=json - Get segment info
// GET /api/demo/stream?segment=0 - Get audio data
export async function GET(request: NextRequest) {
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const segment = request.nextUrl.searchParams.get("segment") || "0";
  const format = request.nextUrl.searchParams.get("format");
  const segmentNum = Math.max(0, Math.min(4, parseInt(segment) || 0));

  // No payment provided - return 402
  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(request, segmentNum);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const chain = getPreferredChain(request);

  // Demo mode - simplified flow
  if (isDemoMode) {
    const settleResponse = createMockSettleResponse(chain);

    // Return JSON metadata if format=json
    if (format === "json") {
      const info = getSegmentInfo(segmentNum);
      const response = NextResponse.json({
        ...info,
        settled: true,
        txHash: settleResponse.transaction,
      });
      response.headers.set("Payment-Response", encodeHeader(settleResponse));
      response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
      return response;
    }

    // Return actual audio data
    const audioBuffer = generateSegmentAudio(segmentNum);
    const response = new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Accept-Ranges": "bytes",
        "X-Segment": segmentNum.toString(),
        "X-Duration": "10",
        "X-Cost": COST_PER_SEGMENT,
        "Payment-Response": encodeHeader(settleResponse),
        "Access-Control-Expose-Headers":
          "Payment-Required, Payment-Response, X-Segment, X-Duration, X-Cost",
      },
    });
    return response;
  }

  // Live mode: verify and settle with facilitator
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = {
    scheme: "upto",
    network: getNetwork(),
    amount: STREAM_MAX_AMOUNT,
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

    // Return JSON metadata if format=json
    if (format === "json") {
      const info = getSegmentInfo(segmentNum);
      const response = NextResponse.json({
        ...info,
        settled: true,
        txHash: settleResult.transaction,
      });
      response.headers.set("Payment-Response", encodeHeader(settleResult));
      response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
      return response;
    }

    // Return actual audio data
    const audioBuffer = generateSegmentAudio(segmentNum);
    const response = new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Accept-Ranges": "bytes",
        "X-Segment": segmentNum.toString(),
        "X-Duration": "10",
        "X-Cost": COST_PER_SEGMENT,
        "Payment-Response": encodeHeader(settleResult),
        "Access-Control-Expose-Headers":
          "Payment-Required, Payment-Response, X-Segment, X-Duration, X-Cost",
      },
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Facilitator error", reason: String(error) },
      { status: 502 }
    );
  }
}

// Support OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Payment-Signature, X-Demo-Mode, X-Preferred-Chain",
      "Access-Control-Expose-Headers": "Payment-Required, Payment-Response, X-Segment, X-Duration, X-Cost",
    },
  });
}
