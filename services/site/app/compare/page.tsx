import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import CompareClient from "./CompareClient";

export const metadata = {
  title: "Compare | t402",
  description:
    "See how t402 compares to traditional payment solutions like Stripe, PayPal, and other crypto payment processors. Zero fees, instant settlement, multi-chain support.",
  openGraph: {
    title: "t402 vs Traditional Payments - Comparison",
    description:
      "Compare t402's HTTP-native stablecoin payments to Stripe, PayPal, and crypto payment processors. Zero fees, instant settlement.",
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
