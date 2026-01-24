import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain } from "@/lib/config";
import { encodeHeader } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";

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
    accepts: getAcceptsForChain(chain, IOT_AMOUNT),
  };
}

function generateReading(type: string) {
  const now = new Date().toISOString();
  switch (type) {
    case "temperature":
      return { type, value: (15 + Math.random() * 20).toFixed(1), unit: "°C", timestamp: now };
    case "humidity":
      return { type, value: (40 + Math.random() * 40).toFixed(0), unit: "%", timestamp: now };
    case "gps":
      return { type, value: `${(35.6 + Math.random() * 0.1).toFixed(4)}, ${(139.7 + Math.random() * 0.1).toFixed(4)}`, unit: "coords", timestamp: now };
    default:
      return { type, value: "0", unit: "unknown", timestamp: now };
  }
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
  const reading = generateReading(type);

  if (isDemoMode) {
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const response = NextResponse.json({ reading, paid: true, cost: "0.0001 USDT" });
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  return NextResponse.json({ reading, paid: true, cost: "0.0001 USDT" });
}
