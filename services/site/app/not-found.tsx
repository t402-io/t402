import Link from "next/link";
import { NavBar } from "./components/NavBar";
import { Footer } from "./components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col">
      <NavBar />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-10">
            <span className="text-9xl font-bold text-gradient-brand">404</span>
            <h1 className="text-2xl font-bold mt-6 text-white">
              Page not found
            </h1>
            <p className="text-[#A1A1AA] mt-3 text-base">
              This resource doesn&apos;t exist — but if it did, you could pay
              for it.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-[#50AF95] px-6 py-3 text-sm font-semibold text-[#0A0A0B] transition-colors hover:bg-[#26A17B]"
            >
              Go home
            </Link>
            <Link
              href="/chains"
              className="inline-flex items-center rounded-xl border border-[#27272A] bg-[#111113] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18181B]"
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
