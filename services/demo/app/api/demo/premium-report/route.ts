import { NextRequest, NextResponse } from "next/server";
import { getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createPaymentRequired, mockPremiumReport, createMockSettleResponse } from "@/lib/mock-responses";

const RESOURCE = {
  url: "/api/demo/premium-report",
  description: "Premium market research report",
};

export async function GET(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  if (!paymentHeader) {
    const paymentRequired = createPaymentRequired(RESOURCE);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

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
    await new Promise((r) => setTimeout(r, 800));
    const settleResponse = createMockSettleResponse(getNetwork());
    const response = NextResponse.json(mockPremiumReport);
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
    const response = NextResponse.json(mockPremiumReport);
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
