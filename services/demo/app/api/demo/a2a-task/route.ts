import { NextRequest, NextResponse } from "next/server";
import { getNetwork, getAsset, PAY_TO, DEMO_AMOUNT } from "@/lib/config";
import { verifyPayment, settlePayment } from "@/lib/t402-server";
import { mockA2aTaskResult } from "@/lib/mock-responses";

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const body = await request.json();

  const { method, params, id } = body;
  const taskId = params?.taskId || "task-demo-" + Date.now().toString(36);

  // Check if this is a payment submission
  const paymentPayload = params?.message?.metadata?.["t402.payment.payload"];

  if (method === "tasks/send" && !paymentPayload) {
    // First request: return payment-required state
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        kind: "task",
        id: taskId,
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Payment is required to process this task." }],
            metadata: {
              "t402.payment.status": "payment-required",
              "t402.payment.required": {
                t402Version: 2,
                accepts: [
                  {
                    scheme: "exact",
                    network: getNetwork(),
                    amount: DEMO_AMOUNT,
                    asset: getAsset(),
                    payTo: PAY_TO,
                    maxTimeoutSeconds: 60,
                    extra: { name: "USDC", version: "2" },
                  },
                ],
              },
            },
          },
        },
      },
    });
  }

  if (method === "tasks/send" && paymentPayload) {
    // Payment submitted — verify and complete task
    if (isDemoMode) {
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          kind: "task",
          ...mockA2aTaskResult,
        },
      });
    }

    // Live mode
    try {
      const requirements = {
        scheme: "exact",
        network: getNetwork(),
        amount: DEMO_AMOUNT,
        asset: getAsset(),
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
        extra: { name: "USDC", version: "2" },
      };

      const verifyResult = await verifyPayment(paymentPayload, requirements);
      if (!verifyResult.isValid) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            kind: "task",
            id: taskId,
            status: {
              state: "failed",
              message: {
                kind: "message",
                role: "agent",
                parts: [{ kind: "text", text: "Payment invalid: " + verifyResult.invalidReason }],
              },
            },
          },
        });
      }

      await settlePayment(paymentPayload, requirements);

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          kind: "task",
          ...mockA2aTaskResult,
        },
      });
    } catch (error) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: "Facilitator error: " + String(error) },
      });
    }
  }

  // Unknown method
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" },
  });
}
