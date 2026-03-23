import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";


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
    const response = NextResponse.json({ article: PREMIUM_ARTICLE });
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
    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Settlement failed", reason: settleResult.errorReason },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ article: PREMIUM_ARTICLE });
    response.headers.set("Payment-Response", encodeHeader(settleResult));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  } catch (error) {
    const reason = String(error);
    const isPaymentIssue = reason.includes('Insufficient balance') || reason.includes('insufficient') || reason.includes('verify_signature');
    return NextResponse.json(
      { error: isPaymentIssue ? 'Payment failed' : 'Facilitator error', reason },
      { status: isPaymentIssue ? 402 : 500 }
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
