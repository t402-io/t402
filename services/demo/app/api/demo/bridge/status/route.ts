import { NextRequest, NextResponse } from "next/server";
import { getBridgeState, getEstimatedTimeRemaining, cleanupOldStates } from "@/lib/bridge-state";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * GET /api/demo/bridge/status?guid=0x...
 * GET /api/demo/bridge/status?real=true&txHash=0x...  (real LayerZero Scan polling)
 * Track LayerZero bridge message status
 */
export async function GET(request: NextRequest) {
  // --- Real LayerZero Scan polling ---
  const isReal = request.nextUrl.searchParams.get("real") === "true";
  const txHash = request.nextUrl.searchParams.get("txHash");

  if (isReal && txHash) {
    try {
      const res = await fetch(
        `https://scan.layerzero-api.com/v1/messages/tx/${txHash}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json();
        const msg = data.data?.[0] || data.messages?.[0];
        if (msg) {
          return NextResponse.json(
            {
              real: true,
              guid: msg.guid || msg.messageGuid,
              status: msg.status || "UNKNOWN",
              srcTxHash:
                msg.srcTxHash || msg.source?.tx?.txHash || txHash,
              dstTxHash:
                msg.dstTxHash || msg.destination?.tx?.txHash || null,
              srcChain: msg.srcEid || msg.pathway?.sender?.chain,
              dstChain: msg.dstEid || msg.pathway?.receiver?.chain,
              created: msg.created,
              updated: msg.updated,
              layerZeroScanUrl: `https://layerzeroscan.com/tx/${txHash}`,
            },
            { headers: CORS_HEADERS },
          );
        }
      }
    } catch {
      // Fall through to simulated status
    }
  }

  // --- Simulated bridge status (existing behavior) ---
  const guid = request.nextUrl.searchParams.get("guid");

  if (!guid) {
    return NextResponse.json(
      { error: "Missing guid parameter" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Clean up old states periodically
  cleanupOldStates();

  const state = getBridgeState(guid);

  if (!state) {
    return NextResponse.json(
      { error: "Bridge transaction not found", guid },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const estimatedTimeRemaining = getEstimatedTimeRemaining(state);

  return NextResponse.json(
    {
      guid: state.guid,
      status: state.status,
      sourceChain: state.sourceChain,
      targetChain: state.targetChain,
      amount: state.amount,
      fee: state.fee,
      srcTxHash: state.srcTxHash,
      dstTxHash: state.dstTxHash,
      recipient: state.recipient,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      estimatedTimeRemaining,
      // LayerZero Scan compatible fields
      layerZeroScan: {
        url: `https://layerzeroscan.com/tx/${state.guid}`,
        status: state.status,
      },
    },
    { headers: CORS_HEADERS },
  );
}

/**
 * Support CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
