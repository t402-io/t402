import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import ChainsClient from "./ChainsClient";

export const metadata = {
  title: "Supported Chains | t402",
  description:
    "Accept USDT payments across 31+ blockchains including Ethereum, Base, Arbitrum, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, and Stacks. Gasless transactions on EVM networks.",
  openGraph: {
    title: "t402 Supported Chains - Multi-Chain Payment Protocol",
    description:
      "31+ chains supported across 9 blockchain families. EVM, Solana, TON, TRON, NEAR, Aptos, Tezos, Polkadot, and Stacks.",
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
