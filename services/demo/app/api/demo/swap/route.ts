import { NextRequest, NextResponse } from "next/server";
import { getPreferredChain, getAcceptsForChain, buildRequirementsFromPayload } from "@/lib/config";
import { encodeHeader, decodeHeader, verifyPayment, settlePayment, isPreBroadcastNetwork } from "@/lib/t402-server";
import { createMockSettleResponse } from "@/lib/mock-responses";
import { classifyFacilitatorError } from "@/lib/error-helpers";
import { getSwapQuote, buildSwapTransaction, getSupportedTokens } from "@/lib/swap-service";

const SWAP_FEE = "10000"; // 0.01 USDT (6 decimals)

const RESOURCE = {
  url: "/api/demo/swap",
  description: "DEX swap execution via ParaSwap aggregator",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const srcToken = searchParams.get("srcToken");
  const destToken = searchParams.get("destToken");
  const amount = searchParams.get("amount");
  const srcDecimals = searchParams.get("srcDecimals");
  const destDecimals = searchParams.get("destDecimals");

  // If query params provided, return a free quote
  if (srcToken && destToken && amount && srcDecimals != null && destDecimals != null) {
    // Validate inputs
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      const response = NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }
    if (srcToken.toLowerCase() === destToken.toLowerCase()) {
      const response = NextResponse.json({ error: "Source and destination tokens must be different" }, { status: 400 });
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    const quote = await getSwapQuote({
      srcToken,
      destToken,
      amount,
      srcDecimals: Number(srcDecimals),
      destDecimals: Number(destDecimals),
    });

    if (!quote) {
      const response = NextResponse.json(
        { error: "Failed to fetch swap quote. Try different tokens or amount." },
        { status: 502 }
      );
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }

    const response = NextResponse.json({ quote });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  }

  // No query params: return supported tokens list
  const tokens = getSupportedTokens();
  const response = NextResponse.json({ tokens });
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

export async function POST(request: NextRequest) {
  const isDemoMode = request.headers.get("x-demo-mode") === "true";
  const paymentHeader = request.headers.get("payment-signature");

  // If no payment header, return 402
  if (!paymentHeader) {
    const chain = getPreferredChain(request);
    const paymentRequired = {
      t402Version: 2,
      error: "Payment required",
      resource: { ...RESOURCE, mimeType: "application/json" },
      accepts: getAcceptsForChain(chain, SWAP_FEE, request),
    };

    const response = NextResponse.json(paymentRequired, { status: 402 });
    response.headers.set("Payment-Required", encodeHeader(paymentRequired));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Parse swap parameters from request body
  let body: { srcToken: string; destToken: string; amount: string; srcDecimals: number; destDecimals: number; userAddress?: string };
  try {
    body = await request.json();
    if (!body.srcToken || !body.destToken || !body.amount || body.srcDecimals == null || body.destDecimals == null) {
      return NextResponse.json(
        { error: "Missing required fields: srcToken, destToken, amount, srcDecimals, destDecimals" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Payment header present — verify and settle
  const paymentPayload = decodeHeader(paymentHeader);
  const requirements = buildRequirementsFromPayload(paymentPayload, SWAP_FEE);

  if (isDemoMode) {
    // Demo mode: simulate verify + settle, but use real quotes
    await new Promise((r) => setTimeout(r, 800));
    const chain = getPreferredChain(request);
    const settleResponse = createMockSettleResponse(chain);

    // Fetch real swap quote from ParaSwap
    const quote = await getSwapQuote(body);
    if (!quote) {
      return NextResponse.json(
        { error: "Failed to fetch swap quote. Try different tokens or amount." },
        { status: 502 }
      );
    }

    // Build swap tx if a real user address is provided
    let swapTx = null;
    if (body.userAddress && body.userAddress !== "demo-wallet" && body.userAddress.startsWith("0x")) {
      swapTx = await buildSwapTransaction({
        srcToken: body.srcToken,
        destToken: body.destToken,
        srcAmount: body.amount,
        priceRoute: quote.priceRoute,
        userAddress: body.userAddress,
      });
    }

    const responseBody: any = { executed: true, quote };
    if (swapTx) responseBody.swapTx = swapTx;
    const response = NextResponse.json(responseBody);
    response.headers.set("Payment-Response", encodeHeader(settleResponse));
    response.headers.set("Access-Control-Expose-Headers", "Payment-Required, Payment-Response");
    return response;
  }

  // Live mode: call real facilitator
  try {
    const isPreBroadcast = isPreBroadcastNetwork(requirements.network);
    let settleResult: any = null;

    if (isPreBroadcast) {
      try {
        const verifyResult = await verifyPayment(paymentPayload, requirements);
        if (verifyResult.isValid) settleResult = await settlePayment(paymentPayload, requirements);
      } catch { /* pre-broadcast: tx already on-chain */ }
      if (!settleResult) {
        settleResult = {
          success: true,
          transaction: (paymentPayload as any)?.payload?.bocHash || (paymentPayload as any)?.payload?.txId || "pre-broadcast",
          network: requirements.network,
          payer: (paymentPayload as any)?.payload?.authorization?.from || (paymentPayload as any)?.payload?.from || "unknown",
        };
      }
    } else {
      const verifyResult = await verifyPayment(paymentPayload, requirements);
      if (!verifyResult.isValid) {
        return NextResponse.json(
          { error: "Payment verification failed", reason: verifyResult.invalidReason },
          { status: 402 }
        );
      }
      settleResult = await settlePayment(paymentPayload, requirements);
      if (!settleResult?.success) {
        return NextResponse.json(
          { error: "Settlement failed", reason: settleResult?.errorReason },
          { status: 500 }
        );
      }
    }

    // Fetch real swap quote from ParaSwap
    const quote = await getSwapQuote(body);
    if (!quote) {
      return NextResponse.json(
        { error: "Failed to fetch swap quote. Try different tokens or amount." },
        { status: 502 }
      );
    }

    // Build swap tx if a real user address is provided
    let swapTx = null;
    if (body.userAddress && body.userAddress !== "demo-wallet" && body.userAddress.startsWith("0x")) {
      swapTx = await buildSwapTransaction({
        srcToken: body.srcToken,
        destToken: body.destToken,
        srcAmount: body.amount,
        priceRoute: quote.priceRoute,
        userAddress: body.userAddress,
      });
    }

    const responseBody: any = { executed: true, quote };
    if (swapTx) responseBody.swapTx = swapTx;
    const response = NextResponse.json(responseBody);
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
