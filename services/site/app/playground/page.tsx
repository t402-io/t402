import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import PlaygroundClient from "./PlaygroundClient";

export const metadata = {
  title: "Playground | t402",
  description:
    "Interactive demo of HTTP 402 payments. Configure payment settings and watch the t402 payment flow in real-time.",
  openGraph: {
    title: "t402 Playground - Interactive Payment Demo",
    description:
      "See how HTTP 402 payments work with USDT and USDC. Configure and test the payment flow live.",
  },
};

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <PlaygroundClient />
      </main>
      <Footer />
    </div>
  );
}
