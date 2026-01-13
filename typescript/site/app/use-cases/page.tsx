import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import UseCasesClient from "./UseCasesClient";

export const metadata = {
  title: "Use Cases | t402",
  description:
    "Discover how t402 enables new payment models - API monetization, content paywalls, AI agent payments, e-commerce checkout, and more.",
  openGraph: {
    title: "t402 Use Cases - HTTP-Native Payment Models",
    description:
      "From micropayments to subscriptions, see how t402 powers payments across industries with USDT and USDC.",
  },
};

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <UseCasesClient />
      </main>
      <Footer />
    </div>
  );
}
