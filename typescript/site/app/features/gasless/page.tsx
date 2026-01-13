import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Gasless Transactions | t402",
  description:
    "Enable USDT and USDC payments without requiring users to hold native tokens for gas. EIP-3009 and ERC-4337 account abstraction support.",
  openGraph: {
    title: "Gasless Transactions - Zero Gas Fees for Users",
    description:
      "Users pay only in stablecoins. No ETH, MATIC, or other native tokens required for gas fees.",
  },
};

export default function GaslessPage() {
  const feature = getFeatureBySlug("gasless");

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
