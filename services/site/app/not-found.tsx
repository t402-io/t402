import Link from "next/link";
import { NavBar } from "./components/NavBar";
import { Footer } from "./components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <span className="text-8xl font-bold text-brand/30">402</span>
            <h1 className="text-2xl font-bold mt-4">Page Not Found</h1>
            <p className="text-foreground-secondary mt-2">
              This resource doesn&apos;t exist — but if it did, you could pay for it.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background-secondary p-5 mb-8 text-left font-mono text-sm">
            <div className="text-foreground-tertiary">
              <span className="text-error">GET</span>{" "}
              <span className="text-foreground-secondary">/unknown-page</span>
            </div>
            <div className="mt-2">
              <span className="text-warning">404</span>{" "}
              <span className="text-foreground-tertiary">Not Found</span>
            </div>
            <div className="mt-2 text-foreground-tertiary/60">
              X-Payment: not accepted here
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-medium transition-colors hover:bg-brand-secondary"
              style={{ color: "#0A0A0B" }}
            >
              Go Home
            </Link>
            <Link
              href="/chains"
              className="inline-flex items-center rounded-lg border border-border bg-background-tertiary px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border"
            >
              Explore Chains
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
