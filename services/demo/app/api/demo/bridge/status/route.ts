import { NextRequest, NextResponse } from "next/server";
import { getBridgeState, getEstimatedTimeRemaining, cleanupOldStates } from "@/lib/bridge-state";

/**
 * GET /api/demo/bridge/status?guid=0x...
 * Track LayerZero bridge message status
 */
export async function GET(request: NextRequest) {
  const guid = request.nextUrl.searchParams.get("guid");

  if (!guid) {
    return NextResponse.json(
      { error: "Missing guid parameter" },
      { status: 400 }
    );
  }

  // Clean up old states periodically
  cleanupOldStates();

  const state = getBridgeState(guid);

  if (!state) {
    return NextResponse.json(
      { error: "Bridge transaction not found", guid },
      { status: 404 }
    );
  }

  const estimatedTimeRemaining = getEstimatedTimeRemaining(state);

  return NextResponse.json({
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
