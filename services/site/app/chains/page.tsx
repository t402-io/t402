import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import ChainsClient from "./ChainsClient";

export const metadata = {
  title: "Supported Chains | t402",
  description:
    "Accept USDT payments across 28 blockchains including Ethereum, Arbitrum, Optimism, Solana, TON, TRON, NEAR, Aptos, Tezos, and Polkadot. Gasless transactions on EVM networks.",
  openGraph: {
    title: "t402 Supported Chains - Multi-Chain Payment Protocol",
    description:
      "28 chains supported across 10 blockchain families. EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, and more.",
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
