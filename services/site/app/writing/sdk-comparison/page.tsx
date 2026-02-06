import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/NavBar";
import { Footer } from "../../components/Footer";

const pageTitle = "Choosing the Right T402 SDK: TypeScript, Python, Go, or Java";
const pageDescription =
  "A comprehensive guide to T402's four official SDKs. Compare features, performance characteristics, and best use cases to choose the right SDK for your project.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/writing/sdk-comparison",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: pageTitle,
  description: pageDescription,
  datePublished: "2026-01-25",
  author: { "@type": "Organization", name: "T402 Team", url: "https://t402.io" },
  publisher: { "@type": "Organization", name: "T402", url: "https://t402.io" },
  url: "https://t402.io/writing/sdk-comparison",
  keywords: ["SDK", "TypeScript", "Python", "Go", "Java", "Comparison"],
};

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

interface SdkInfo {
  name: string;
  version: string;
  packageManager: string;
  installCommand: string;
  runtime: string;
  bestFor: string[];
  packages: number;
  color: string;
}

const sdks: SdkInfo[] = [
  {
    name: "TypeScript",
    version: "v2.4.0",
    packageManager: "npm / pnpm",
    installCommand: "npm install @t402/core @t402/evm",
    runtime: "Node.js 18+, Bun, Deno",
    bestFor: ["Web applications", "React/Vue/Next.js", "Serverless functions", "Full-stack apps"],
    packages: 21,
    color: "#3178C6",
  },
  {
    name: "Python",
    version: "v1.10.0",
    packageManager: "pip / uv",
    installCommand: "pip install t402",
    runtime: "Python 3.10+",
    bestFor: ["AI/ML backends", "FastAPI/Flask APIs", "Data pipelines", "Jupyter notebooks"],
    packages: 1,
    color: "#3776AB",
  },
  {
    name: "Go",
    version: "v1.9.0",
    packageManager: "go modules",
    installCommand: "go get github.com/t402-io/t402/sdks/go",
    runtime: "Go 1.24+",
    bestFor: ["High-performance APIs", "Microservices", "CLI tools", "Infrastructure"],
    packages: 1,
    color: "#00ADD8",
  },
  {
    name: "Java",
    version: "v1.9.0",
    packageManager: "Maven / Gradle",
    installCommand: "<dependency>io.t402:t402:1.9.0</dependency>",
    runtime: "Java 21+",
    bestFor: ["Enterprise systems", "Spring Boot", "Android apps", "Large-scale backends"],
    packages: 1,
    color: "#ED8B00",
  },
];

function SdkCard({ sdk }: { sdk: SdkInfo }) {
  return (
    <div className="rounded-xl border border-border bg-background-secondary p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">{sdk.name}</h3>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: sdk.color }}
        >
          {sdk.version}
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-foreground-tertiary">Package Manager</p>
          <p className="font-medium text-foreground">{sdk.packageManager}</p>
        </div>
        <div>
          <p className="text-foreground-tertiary">Runtime</p>
          <p className="font-medium text-foreground">{sdk.runtime}</p>
        </div>
        <div>
          <p className="text-foreground-tertiary">Best For</p>
          <ul className="mt-1 space-y-1">
            {sdk.bestFor.map((use) => (
              <li key={use} className="text-foreground-secondary">
                {use}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border bg-background-tertiary p-3 font-mono text-xs text-foreground-secondary">
        {sdk.installCommand}
      </div>
    </div>
  );
}

export default function SdkComparisonPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <div className="flex-1">
        <article className="pb-20">
          {/* Header */}
          <header className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pt-12 sm:pt-16 md:pt-20">
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                SDK
              </span>
              <span className="rounded-md bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                Guide
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              Choosing the Right T402 SDK
            </h1>
            <p className="text-base text-foreground-tertiary mb-2">January 25, 2026</p>
            <p className="text-base text-foreground-tertiary mb-8">By: T402 Team</p>
          </header>

          {/* Article Body */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 space-y-8">
            {/* TL;DR */}
            <div className="rounded-xl border border-border bg-background-secondary p-6">
              <p className="text-base leading-relaxed text-foreground-secondary">
                <strong className="text-foreground">TL;DR</strong>: T402 offers official SDKs in TypeScript, Python, Go, and Java. All SDKs support the same 28 blockchains and payment schemes. Choose TypeScript for web apps, Python for AI/ML, Go for high-performance services, and Java for enterprise systems.
              </p>
            </div>

            {/* Overview */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Overview</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                T402 provides four official SDKs to match your technology stack. Each SDK implements the full T402 protocol specification, supporting all 28 blockchains across 10 families with identical payment flows.
              </p>
              <p className="text-base leading-relaxed text-foreground-secondary">
                The core functionality is consistent across all SDKs: create payment requirements, sign payment payloads, verify signatures, and settle on-chain. The difference lies in language idioms, ecosystem integration, and performance characteristics.
              </p>
            </section>

            {/* SDK Cards */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">SDK Comparison</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {sdks.map((sdk) => (
                  <SdkCard key={sdk.name} sdk={sdk} />
                ))}
              </div>
            </section>

            {/* Feature Matrix */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Feature Matrix</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-left font-medium text-foreground-tertiary">Feature</th>
                      <th className="px-4 py-3 text-center font-medium">TypeScript</th>
                      <th className="px-4 py-3 text-center font-medium">Python</th>
                      <th className="px-4 py-3 text-center font-medium">Go</th>
                      <th className="px-4 py-3 text-center font-medium">Java</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground-secondary">
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Supported Chains</td>
                      <td className="px-4 py-3 text-center">28</td>
                      <td className="px-4 py-3 text-center">28</td>
                      <td className="px-4 py-3 text-center">28</td>
                      <td className="px-4 py-3 text-center">28</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">HTTP Middleware</td>
                      <td className="px-4 py-3 text-center text-brand">Express, Hono, Fastify, Next.js</td>
                      <td className="px-4 py-3 text-center text-brand">FastAPI, Flask</td>
                      <td className="px-4 py-3 text-center text-brand">Gin, Echo</td>
                      <td className="px-4 py-3 text-center text-brand">Spring Boot</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">MCP Server</td>
                      <td className="px-4 py-3 text-center text-brand">Yes</td>
                      <td className="px-4 py-3 text-center">Planned</td>
                      <td className="px-4 py-3 text-center text-brand">Yes</td>
                      <td className="px-4 py-3 text-center">Planned</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">CLI Tool</td>
                      <td className="px-4 py-3 text-center text-brand">@t402/cli</td>
                      <td className="px-4 py-3 text-center text-brand">t402 CLI</td>
                      <td className="px-4 py-3 text-center text-brand">t402 binary</td>
                      <td className="px-4 py-3 text-center">N/A</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 pr-4">Type Safety</td>
                      <td className="px-4 py-3 text-center">Full (Zod)</td>
                      <td className="px-4 py-3 text-center">Full (Pydantic)</td>
                      <td className="px-4 py-3 text-center">Full (native)</td>
                      <td className="px-4 py-3 text-center">Full (native)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recommendations */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Recommendations</h2>

              <div className="rounded-xl border border-border bg-background-secondary p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Choose TypeScript if...</h3>
                <ul className="list-disc pl-5 space-y-1 text-foreground-secondary">
                  <li>You&apos;re building a web application (React, Vue, Next.js)</li>
                  <li>You want the most complete ecosystem with 21 packages</li>
                  <li>You need React/Vue components for payment UIs</li>
                  <li>You&apos;re deploying to serverless platforms (Vercel, Cloudflare Workers)</li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background-secondary p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Choose Python if...</h3>
                <ul className="list-disc pl-5 space-y-1 text-foreground-secondary">
                  <li>You&apos;re building AI/ML services that need payment capabilities</li>
                  <li>Your backend is FastAPI or Flask</li>
                  <li>You want easy integration with data science workflows</li>
                  <li>You prefer async/await with native asyncio support</li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background-secondary p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Choose Go if...</h3>
                <ul className="list-disc pl-5 space-y-1 text-foreground-secondary">
                  <li>Performance is critical (high-throughput APIs)</li>
                  <li>You&apos;re building microservices or infrastructure</li>
                  <li>You want a single static binary deployment</li>
                  <li>You need the lowest memory footprint</li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background-secondary p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Choose Java if...</h3>
                <ul className="list-disc pl-5 space-y-1 text-foreground-secondary">
                  <li>You&apos;re in an enterprise environment with existing Java infrastructure</li>
                  <li>You&apos;re using Spring Boot or Jakarta EE</li>
                  <li>You need JVM ecosystem compatibility (Kotlin, Scala)</li>
                  <li>You&apos;re building Android applications</li>
                </ul>
              </div>
            </section>

            {/* Get Started */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold mt-8">Get Started</h2>
              <p className="text-base leading-relaxed text-foreground-secondary">
                All T402 SDKs are open source and available on their respective package registries. Start accepting stablecoin payments in minutes:
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/sdks"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-medium transition-colors hover:bg-brand-secondary"
                  style={{ color: "#0A0A0B" }}
                >
                  View All SDKs
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="https://docs.t402.io/getting-started/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-6 py-3 text-base font-medium text-foreground transition-colors hover:bg-border"
                >
                  Read Documentation
                </Link>
              </div>
            </section>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
