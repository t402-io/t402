import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";


const AI_AMOUNT = "1000"; // 0.001 USDT per query

const RESOURCE = {
  url: "/api/demo/ai-query",
  description: "AI-powered query — pay per request with USDT",
};

function createAiPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: { ...RESOURCE, mimeType: "application/json" },
    accepts: getAcceptsForChain(chain, AI_AMOUNT),
  };
}

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  // If no payment header, return 402
  if (!paymentHeader) {
    const paymentRequired = createAiPaymentRequired(request);
    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Parse the request body for the query
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const query = body.query || "What is HTTP 402?";

  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, AI_AMOUNT);

  if (isDemoMode) {
    // Demo mode: use real LLM if API key available, else mock
    await new Promise((r) => setTimeout(r, 300));

    const aiResponse = await generateAiResponse(query);
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);

    const response = NextResponse.json({
      query,
      response: aiResponse,
      model: process.env.ANTHROPIC_API_KEY ? "claude-haiku" : "mock",
      cost: "0.001 USDT",
    });
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: verify and settle, then call LLM
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

    const aiResponse = await generateAiResponse(query);

    const response = NextResponse.json({
      query,
      response: aiResponse,
      model: process.env.ANTHROPIC_API_KEY ? "claude-haiku" : "mock",
      cost: "0.001 USDT",
    });
    response.headers.set("Payment-Response", encodeHeader(settleResult));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Facilitator error", reason: String(error) },
      { status: 502 }
    );
  }
}

async function generateAiResponse(query: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return getMockResponse(query);
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
      system: "You are a helpful AI assistant accessed via the T402 HTTP 402 payment protocol. Keep responses concise (2-3 sentences max). You are demonstrating pay-per-query AI API monetization.",
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock?.text ?? "No response generated.";
  } catch {
    return getMockResponse(query);
  }
}

function getMockResponse(query: string): string {
  if (query.toLowerCase().includes("402")) {
    return "HTTP 402 is a status code meaning 'Payment Required'. T402 uses it to enable seamless micropayments — servers respond with payment requirements, clients sign USDT authorizations, and facilitators settle on-chain.";
  }
  if (query.toLowerCase().includes("t402")) {
    return "T402 is an open-source HTTP-native payment protocol for USDT/USDT0 stablecoins. It enables web services to require cryptocurrency payments without intermediaries using a simple request-response pattern.";
  }
  return `This is a demonstration of pay-per-query AI monetization via T402. Your query "${query.slice(0, 50)}" would be processed by Claude and charged 0.001 USDT per request — no API keys, no subscriptions, just pay and use.`;
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed", reason: "Use POST with a JSON body", example: { query: "What is T402?" } },
    { status: 405 }
  );
}

// Support OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Payment-Signature, x-preferred-chain, x-demo-mode",
      "Access-Control-Expose-Headers": "Payment-Required, Payment-Response",
    },
  });
}
