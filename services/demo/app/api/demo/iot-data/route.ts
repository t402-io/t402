import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment, recordSettlement, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { classifyFacilitatorError } from "@/lib/error-helpers";
import { getReading } from "@/lib/weather-service";


const IOT_AMOUNT = "100"; // 0.0001 USDT per reading

function createPaymentRequired(type: string, request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: {
      url: `/api/demo/iot-data?type=${type}`,
      description: `IoT ${type} sensor reading`,
      mimeType: "application/json",
    },
    accepts: getAcceptsForChain(chain, IOT_AMOUNT, request),
  };
}


export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "temperature";
  const paymentHeader = request.headers.get("payment-signature");
  const isDemoMode = request.headers.get("x-demo-mode") === "true";

  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(type, request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Payment received
  const sensorType = (["temperature", "humidity", "gps"].includes(type) ? type : "temperature") as "temperature" | "humidity" | "gps";
  const reading = await getReading(sensorType);

  if (isDemoMode) {
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json({ reading, paid: true, cost: "0.0001 USDT" });
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle with facilitator
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, IOT_AMOUNT);

  try {
    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/iot-data", description: "IoT Data Feed" });
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
          metadata: { source: "demo.t402.io/iot-data", description: "IoT Data Feed", preBroadcast: true },
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
      settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/iot-data", description: "IoT Data Feed" });
      if (!settleResult?.success) {
        return NextResponse.json(
          { error: "Settlement failed", reason: settleResult?.errorReason },
          { status: 500 }
        );
      }
    }

    const response = NextResponse.json({ reading, paid: true, cost: "0.0001 USDT" });
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
