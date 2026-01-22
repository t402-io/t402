import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import FeaturesClient from "./FeaturesClient";

export const metadata = {
  title: "Features | t402",
  description:
    "Advanced payment features including gasless transactions, cross-chain bridging, AI agent payments via MCP, and multi-signature wallet support.",
  openGraph: {
    title: "t402 Features - Advanced Payment Capabilities",
    description:
      "Gasless transactions, cross-chain bridge, AI agent payments, and multi-sig support for enterprise-grade stablecoin payments.",
  },
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <FeaturesClient />
      </main>
      <Footer />
    </div>
  );
}
