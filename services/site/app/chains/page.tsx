import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import ChainsClient from "./ChainsClient";

export const metadata = {
  title: "Supported Chains | t402",
  description:
    "Accept USDT and USDC payments across 10+ blockchain networks including Ethereum, Base, Arbitrum, Solana, TON, and TRON. Multi-chain support with gasless transactions.",
  openGraph: {
    title: "t402 Supported Chains - Multi-Chain Payment Protocol",
    description:
      "10+ chains supported including Ethereum, Base, Arbitrum, Solana, TON, and TRON. Gasless transactions on EVM networks.",
  },
};

export default function ChainsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <ChainsClient />
      </main>
      <Footer />
    </div>
  );
}
