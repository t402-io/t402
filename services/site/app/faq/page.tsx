import type { Metadata } from "next";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { FAQClient } from "./FAQClient";

export const metadata: Metadata = {
  title: "FAQ - T402",
  description:
    "Frequently asked questions about T402, the HTTP-native payment protocol for USDT stablecoins across 28 blockchains.",
  openGraph: {
    title: "FAQ - T402",
    description:
      "Frequently asked questions about T402, the HTTP-native payment protocol for USDT stablecoins.",
    url: "/faq",
  },
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />
      <div className="flex-1">
        <FAQClient />
      </div>
      <Footer />
    </div>
  );
}
