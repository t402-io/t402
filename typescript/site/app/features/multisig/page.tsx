import { notFound } from "next/navigation";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";
import FeaturePageClient from "../FeaturePageClient";
import { getFeatureBySlug } from "../data";

export const metadata = {
  title: "Multi-Signature Support | t402",
  description:
    "Accept payments to multi-signature wallets using Safe. Enterprise-grade security with flexible M-of-N signing requirements.",
  openGraph: {
    title: "Multi-Sig Support - Enterprise Security with Safe",
    description:
      "Shared custody, role-based access, and audit compliance for teams, DAOs, and enterprises.",
  },
};

export default function MultisigPage() {
  const feature = getFeatureBySlug("multisig");

  if (!feature) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <FeaturePageClient feature={feature} />
      </main>
      <Footer />
    </div>
  );
}
