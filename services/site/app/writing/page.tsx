import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import WritingClient from "./WritingClient";

export const metadata = {
  title: "Writing | t402",
  description:
    "Articles, announcements, and deep dives from the t402 team. Learn about protocol updates, technical guides, and ecosystem developments.",
  openGraph: {
    title: "t402 Writing - Articles & Announcements",
    description:
      "Articles, announcements, and deep dives from the t402 team about HTTP-native stablecoin payments.",
  },
};

export default function WritingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <WritingClient />
      </main>
      <Footer />
    </div>
  );
}
