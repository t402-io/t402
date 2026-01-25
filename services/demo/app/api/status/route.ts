import { NextResponse } from "next/server";
import { FACILITATOR_URL, getNetwork, getAsset, PAY_TO } from "@/lib/config";


export async function GET() {
  let facilitatorOnline = false;
  let supportedCount = 0;

  try {
    const res = await fetch(`${FACILITATOR_URL}/health`, { next: { revalidate: 30 } });
    facilitatorOnline = res.ok;

    if (facilitatorOnline) {
      const supported = await fetch(`${FACILITATOR_URL}/supported`, { next: { revalidate: 60 } });
      const data = await supported.json();
      supportedCount = data?.kinds?.length || 0;
    }
  } catch {
    facilitatorOnline = false;
  }

  return NextResponse.json({
    status: "ok",
    facilitator: {
      url: FACILITATOR_URL,
      online: facilitatorOnline,
      supportedNetworks: supportedCount,
    },
    demo: {
      network: getNetwork(),
      asset: getAsset(),
      payTo: PAY_TO,
      testnet: process.env.NEXT_PUBLIC_TESTNET === "true",
    },
  });
}
