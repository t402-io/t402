import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, getNetwork, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, verifyPayment, settlePayment, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import {
  parseRequest,
  getTool,
  listTools,
  createPaymentRequiredError,
  createToolResponse,
  createErrorResponse,
  MCP_TOOLS,
  type PaymentMeta,
} from "@/lib/mcp-protocol";

/**
 * POST /api/demo/mcp-tool
 * MCP JSON-RPC 2.0 endpoint with T402 payment integration
 */
export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const chain = getPreferredChain(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      createErrorResponse(0, -32700, "Parse error: Invalid JSON")
    );
  }

  // Parse JSON-RPC request
  const { request: rpcRequest, payment, error: parseError } = parseRequest(body);

  if (parseError || !rpcRequest) {
    return NextResponse.json(
      createErrorResponse(0, -32600, parseError || "Invalid request")
    );
  }

  const { method, params, id } = rpcRequest;

  // Handle tools/list method
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: listTools(),
      },
    });
  }

  // Handle tools/call method
  if (method !== "tools/call") {
    return NextResponse.json(
      createErrorResponse(id, -32601, `Method not found: ${method}`)
    );
  }

  // Get tool name from params
  const toolName = (params as { name?: string })?.name;
  if (!toolName) {
    return NextResponse.json(
      createErrorResponse(id, -32602, "Missing tool name in params")
    );
  }

  // Find the tool
  const tool = getTool(toolName);
  if (!tool) {
    return NextResponse.json(
      createErrorResponse(id, -32602, `Unknown tool: ${toolName}`, {
        availableTools: MCP_TOOLS.map((t) => t.name),
      })
    );
  }

  // No payment provided - return 402 error
  if (!payment) {
    const accepts = getAcceptsForChain(chain, tool.cost, request);
    return NextResponse.json(createPaymentRequiredError(id, tool, accepts));
  }

  // Payment provided - process it
  const toolArgs = (params as { arguments?: Record<string, unknown> })?.arguments || {};

  if (isDemoMode) {
    // Demo mode: skip verification, execute tool
    await new Promise((r) => setTimeout(r, 400));

    const result = await tool.execute(toolArgs);
    const settleResponse = createMockSettleResponse(chain);

    return NextResponse.json(
      createToolResponse(id, result, {
        success: true,
        transaction: settleResponse.transaction,
        network: getNetwork(),
        payer: "0xDemoUser",
      })
    );
  }

  // Live mode: verify and settle with facilitator
  try {
    // Extract payment payload from MCP meta
    const paymentPayload = payment as PaymentMeta;

    const requirements = buildRequirementsFromPayload(paymentPayload.payload, tool.cost);

    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload.payload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload.payload, requirements, { source: "demo.t402.io/mcp-tool", description: "MCP AI Tool" });
      } catch { /* pre-broadcast */ }
      if (!settleResult) {
        settleResult = { success: true, transaction: "pre-broadcast", network: requirements.network };
      }
    } else {
      const verifyResult = await verifyPayment(paymentPayload.payload, requirements);
      if (!verifyResult.isValid) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: 402,
            message: "Payment verification failed",
            data: {
              reason: verifyResult.invalidReason,
              "t402/payment-response": {
                success: false,
                error: verifyResult.invalidReason,
              },
            },
          },
        });
      }

      settleResult = await settlePayment(paymentPayload.payload, requirements, { source: "demo.t402.io/mcp-tool", description: "MCP AI Tool" });
    }

    if (!settleResult?.success) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: "Settlement failed",
          data: {
            reason: settleResult.errorReason,
            "t402/payment-response": {
              success: false,
              error: settleResult.errorReason,
            },
          },
        },
      });
    }

    // Execute tool after successful payment
    const result = await tool.execute(toolArgs);

    return NextResponse.json(
      createToolResponse(id, result, {
        success: true,
        transaction: settleResult.transaction,
        network: requirements.network,
        payer: paymentPayload.payload?.authorization?.from as string,
      })
    );
  } catch (error) {
    console.error("[mcp-tool-error]", error);
    return NextResponse.json(
      createErrorResponse(id, -32603, "Internal error: An unexpected error occurred")
    );
  }
}

/**
 * GET /api/demo/mcp-tool - List available tools
 */
export async function GET() {
  return NextResponse.json({
    protocol: "MCP",
    version: "2024-11-05",
    transport: "HTTP",
    t402: {
      version: 2,
      paymentMethod: "_meta['t402/payment']",
    },
    tools: listTools(),
    usage: {
      listTools: "POST with { method: 'tools/list' }",
      callTool: "POST with { method: 'tools/call', params: { name: 'analyze', arguments: {...} } }",
      withPayment: "Include _meta: { 't402/payment': {...} } in params",
    },
  });
}

/**
 * Support CORS preflight
 */
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
