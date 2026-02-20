import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import CompareClient from "./CompareClient";

export const metadata = {
  title: "Why T402 | t402",
  description:
    "Discover why T402 is the leading HTTP-native stablecoin payment protocol. 44 networks, 4 SDKs, 18 HTTP framework integrations, AI agent support, and more.",
  openGraph: {
    title: "Why T402 - The Payment Protocol for USDT",
    description:
      "44 networks, 4 SDKs, zero fees, instant settlement. See why T402 is the best way to accept stablecoin payments.",
  },
};

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <CompareClient />
      </main>
      <Footer />
    </div>
  );
}
