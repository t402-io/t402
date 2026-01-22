import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Cross-Chain Bridge | t402",
  description:
    "Bridge USDT seamlessly between supported chains using LayerZero's OFT standard. Same token, any chain with unified liquidity.",
  openGraph: {
    title: "Cross-Chain Bridge - USDT0 via LayerZero",
    description:
      "Seamless USDT bridging across Ethereum, Arbitrum, Berachain, Unichain, and Ink using LayerZero OFT.",
  },
};

export default function BridgePage() {
  const feature = getFeatureBySlug("bridge");

  if (!feature) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <FeaturePageClient feature={feature} />
      </main>
      <Footer />
    </div>
  );
}
