import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { ValueProps } from "./components/ValueProps";
import { Stats } from "./components/Stats";
import { HowItWorks } from "./components/HowItWorks";
import { CodeExamples } from "./components/CodeExamples";
import { FeatureDeepDives } from "./components/FeatureDeepDives";
import { UseCasesPreview } from "./components/UseCasesPreview";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Hero />
      <ValueProps />
      <Stats />
      <HowItWorks />
      <CodeExamples />
      <FeatureDeepDives />
      <UseCasesPreview />
      <CTA />
      <Footer />
    </div>
  );
}
