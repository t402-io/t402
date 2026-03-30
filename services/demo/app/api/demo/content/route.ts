import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment, recordSettlement, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { classifyFacilitatorError } from "@/lib/error-helpers";


const CONTENT_AMOUNT = "10000"; // 0.01 USDT per article

const RESOURCE = {
  url: "/api/demo/content",
  description: "Premium article — pay to unlock with USDT",
};

function createContentPaymentRequired(request: NextRequest) {
  const chain = getPreferredChain(request);
  return {
    t402Version: 2,
    error: "Payment required",
    resource: { ...RESOURCE, mimeType: "application/json" },
    accepts: getAcceptsForChain(chain, CONTENT_AMOUNT, request),
  };
}

const PREMIUM_ARTICLE = {
  title: "The Future of Machine-to-Machine Payments",
  author: "T402 Research",
  publishedAt: "2026-02-01T00:00:00Z",
  readTime: "5 min",
  content: [
    {
      type: "paragraph",
      text: "As AI agents become increasingly autonomous, they need the ability to pay for resources on behalf of their users. Traditional payment methods — credit cards, API keys, monthly subscriptions — create friction that slows down agent-to-agent commerce.",
    },
    {
      type: "paragraph",
      text: "HTTP 402 was designed precisely for this future. By embedding payment requirements directly into HTTP responses, any service can become monetizable without intermediaries. The T402 protocol implements this vision with USDT stablecoins, enabling micropayments as small as $0.001 per request.",
    },
    {
      type: "heading",
      text: "Why Stablecoins for Machine Payments?",
    },
    {
      type: "paragraph",
      text: "Stablecoins eliminate the volatility risk that makes other cryptocurrencies impractical for automated payments. When an AI agent pays 0.001 USDT for an API call, both parties know exactly what that costs in real terms. USDT0, the cross-chain version via LayerZero OFT, extends this to any blockchain.",
    },
    {
      type: "heading",
      text: "The EIP-3009 Advantage",
    },
    {
      type: "paragraph",
      text: "T402 uses EIP-3009 TransferWithAuthorization, which allows gasless payments. The client signs an off-chain authorization, and the facilitator executes it on-chain. This means users never need to hold ETH for gas — they only need USDT.",
    },
    {
      type: "heading",
      text: "Real-World Applications",
    },
    {
      type: "paragraph",
      text: "Pay-per-query AI APIs, content paywalls, data marketplace access, agent-to-agent task delegation — all become possible with sub-cent micropayments. No subscriptions, no API key management, no monthly minimums.",
    },
  ],
  preview: "As AI agents become increasingly autonomous, they need the ability to pay for resources on behalf of their users...",
};

export async function GET(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  // If no payment header, return 402 with preview
  if (!paymentHeader) {
    const paymentRequired = createContentPaymentRequired(request);
    const response = NextResponse.json(
      {
        ...paymentRequired,
        preview: {
          title: PREMIUM_ARTICLE.title,
          author: PREMIUM_ARTICLE.author,
          readTime: PREMIUM_ARTICLE.readTime,
          preview: PREMIUM_ARTICLE.preview,
        },
      },
      { status: 402 }
    );
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, CONTENT_AMOUNT);

  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 600));
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);
    const article = await generateArticle();
    const response = NextResponse.json({ article });
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  try {
    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/content", description: "Content Paywall" });
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
          metadata: { source: "demo.t402.io/content", description: "Content Paywall", preBroadcast: true },
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
      settleResult = await settlePayment(paymentPayload, requirements, { source: "demo.t402.io/content", description: "Content Paywall" });
      if (!settleResult?.success) {
        return NextResponse.json(
          { error: "Settlement failed", reason: settleResult?.errorReason },
          { status: 500 }
        );
      }
    }

    const article = await generateArticle();
    const response = NextResponse.json({ article });
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

// ---------------------------------------------------------------------------
// AI Article Generation
// ---------------------------------------------------------------------------

async function generateArticle() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return PREMIUM_ARTICLE; // Fallback to static
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Pick a random topic for variety
    const topics = [
      "How AI agents are transforming crypto payments in 2026",
      "The rise of USDT0 and cross-chain stablecoin transfers",
      "Why HTTP 402 is the missing payment layer of the internet",
      "ERC-4337 account abstraction and the future of gasless payments",
      "Machine-to-machine micropayments: the trillion-dollar opportunity",
      "LayerZero OFT and the unification of stablecoin liquidity",
      "How MCP (Model Context Protocol) enables AI agent commerce",
      "The death of API keys: pay-per-request as the new business model",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Write a short premium article (200-300 words) about: ${topic}. Include 2-3 section headings. Professional but accessible style. Title on first line, headings with ## prefix.`,
        },
      ],
      system: "You are a premium content writer for T402, an HTTP payment protocol for USDT stablecoins. Write concise, insightful articles. Title on first line (no # prefix), section headings with ## prefix. Keep under 300 words.",
    });

    const textBlocks = message.content.filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => (b as any).text).join("\n\n").trim();

    // Parse plain text: first line = title, ## = headings, rest = paragraphs
    const lines = rawText.split("\n").filter((l) => l.trim());
    const title = lines[0]?.replace(/^#+\s*/, "").replace(/^\*\*(.+)\*\*$/, "$1").trim() || "Latest in Crypto & AI";

    const content: Array<{ type: string; text: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("##") || line.startsWith("**") && line.endsWith("**") && line.length < 80) {
        content.push({ type: "heading", text: line.replace(/^#+\s*/, "").replace(/^\*\*(.+)\*\*$/, "$1") });
      } else {
        content.push({ type: "paragraph", text: line.replace(/^\*\*(.+)\*\*$/, "$1") });
      }
    }

    return {
      title,
      author: "T402 Research · AI Generated",
      publishedAt: new Date().toISOString(),
      readTime: "3 min",
      content: content.length > 0 ? content : [{ type: "paragraph", text: rawText }],
    };
  } catch (err) {
    console.error("[content] AI generation failed:", err);
    return PREMIUM_ARTICLE; // Fallback to static
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
