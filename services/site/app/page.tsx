import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { WhatsT402Section } from "./components/WhatsT402Section";
import { HowItWorks } from "./components/HowItWorks";
import { CodeExamples } from "./components/CodeExamples";
import { Stats } from "./components/Stats";
import { FeatureDeepDives } from "./components/FeatureDeepDives";
import { UseCasesPreview } from "./components/UseCasesPreview";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <WhatsT402Section />
      <HowItWorks />
      <CodeExamples />
      <Stats />
      <FeatureDeepDives />
      <UseCasesPreview />
      <CTA />
      <Footer />
    </div>
  );
}
