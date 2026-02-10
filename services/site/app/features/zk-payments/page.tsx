import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Zero-Knowledge Payments | t402",
  description:
    "Privacy-preserving payments with zero-knowledge proofs. Hide transaction amounts while proving payment validity with selective disclosure.",
  openGraph: {
    title: "Zero-Knowledge Payments - Privacy-Preserving Transactions",
    description:
      "Make payments with ZK proofs to hide amounts while proving validity. Compliance-friendly privacy with selective disclosure.",
  },
};

export default function ZKPaymentsPage() {
  const feature = getFeatureBySlug("zk-payments");

  if (!feature) {
    notFound();
  }

  return (
    <div className="min-h-screen" style={{ background: "#0A0A0B", color: "#FAFAFA" }}>
      <NavBar />
      <main>
        <FeaturePageClient feature={feature} />
      </main>
      <Footer />
    </div>
  );
}
