import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import BrandClient from "./BrandClient";

export const metadata = {
  title: "Brand | t402",
  description:
    "T402 brand guidelines, logos, and assets. Download official logos and learn about proper brand usage.",
  openGraph: {
    title: "T402 Brand Guidelines",
    description:
      "Official T402 brand assets, logos, and usage guidelines for the USDT payment protocol.",
  },
};

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <BrandClient />
      </main>
      <Footer />
    </div>
  );
}
