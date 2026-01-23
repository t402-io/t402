import { NextRequest, NextResponse } from "next/server";
import { getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { verifyPayment, settlePayment } from "@/lib/t402-server";
import { mockMcpToolResult, createMockSettleResponse } from "@/lib/mock-responses";

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const body = await request.json();

  const { method, params, id } = body;

  if (method !== "tools/call") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    });
  }

  // Check if payment is included in _meta
  const paymentPayload = params?._meta?.["t402/payment"];

  if (!paymentPayload) {
    // Return 402 in MCP format
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: 402,
        message: "Payment required",
        data: {
          t402Version: 2,
          error: "Payment required to access this tool",
          resource: {
            url: `mcp://tool/${params?.name || "unknown"}`,
            description: `Premium tool: ${params?.name || "unknown"}`,
            mimeType: "application/json",
          },
          accepts: [
            {
              scheme: "exact",
              network: getNetwork(),
              amount: DEMO_AMOUNT,
              asset: getAsset(),
              payTo: PAY_TO,
              maxTimeoutSeconds: 60,
              extra: { name: "USDT", version: "2" },
            },
          ],
        },
      },
    });
  }

  // Payment present — verify and return result
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({
      ...mockMcpToolResult,
      id,
    });
  }

  // Live mode: verify with facilitator
  try {
    const requirements = {
      scheme: "exact",
      network: getNetwork(),
      amount: DEMO_AMOUNT,
      asset: getAsset(),
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      extra: { name: "USDT", version: "2" },
    };

    const verifyResult = await verifyPayment(paymentPayload, requirements);
    if (!verifyResult.isValid) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: 402, message: "Payment invalid: " + verifyResult.invalidReason },
      });
    }

    await settlePayment(paymentPayload, requirements);

    return NextResponse.json({
      ...mockMcpToolResult,
      id,
    });
  } catch (error) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Facilitator error: " + String(error) },
    });
  }
}
