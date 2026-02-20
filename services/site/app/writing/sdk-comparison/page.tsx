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
    version: "v2.6.0",
    packageManager: "npm / pnpm",
    installCommand: "npm install @t402/core @t402/evm",
    runtime: "Node.js 18+, Bun, Deno",
    bestFor: ["Web applications", "React/Vue/Next.js", "Serverless functions", "Full-stack apps"],
    packages: 36,
    color: "#3178C6",
  },
  {
    name: "Python",
    version: "v1.11.0",
    packageManager: "pip / uv",
    installCommand: "pip install t402",
    runtime: "Python 3.10+",
    bestFor: ["AI/ML backends", "FastAPI/Flask APIs", "Data pipelines", "Jupyter notebooks"],
    packages: 1,
    color: "#3776AB",
  },
  {
    name: "Go",
    version: "v1.11.0",
    packageManager: "go modules",
    installCommand: "go get github.com/t402-io/t402/sdks/go",
    runtime: "Go 1.24+",
    bestFor: ["High-performance APIs", "Microservices", "CLI tools", "Infrastructure"],
    packages: 1,
    color: "#00ADD8",
  },
  {
    name: "Java",
    version: "v1.11.0",
    packageManager: "Maven / Gradle",
    installCommand: "<dependency>io.t402:t402:1.11.0</dependency>",
    runtime: "Java 21+",
    bestFor: ["Enterprise systems", "Spring Boot", "Android apps", "Large-scale backends"],
    packages: 1,
    color: "#ED8B00",
  },
];

function SdkCard({ sdk }: { sdk: SdkInfo }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>{sdk.name}</h3>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: sdk.color }}
        >
          {sdk.version}
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p style={{ color: "#A1A1AA" }}>Package Manager</p>
          <p className="font-medium" style={{ color: "#1A1A2E" }}>{sdk.packageManager}</p>
        </div>
        <div>
          <p style={{ color: "#A1A1AA" }}>Runtime</p>
          <p className="font-medium" style={{ color: "#1A1A2E" }}>{sdk.runtime}</p>
        </div>
        <div>
          <p style={{ color: "#A1A1AA" }}>Best For</p>
          <ul className="mt-1 space-y-1">
            {sdk.bestFor.map((use) => (
              <li key={use} style={{ color: "#4A5568" }}>
                {use}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className="mt-4 rounded-xl p-3 font-mono text-xs"
        style={{ backgroundColor: "#111113", color: "#A1A1AA" }}
      >
        {sdk.installCommand}
      </div>
    </div>
  );
}

export default function SdkComparisonPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0A0A0B", color: "#FAFAFA" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NavBar />

      <div className="flex-1">
        <article>
          {/* Dark Header */}
          <header className="py-24 md:py-32" style={{ backgroundColor: "#0A0A0B" }}>
            <div className="max-w-3xl mx-auto px-6">
              <div className="mb-6 flex flex-wrap gap-2">
                {["SDK", "Guide"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md px-3 py-1 text-sm font-medium"
                    style={{ backgroundColor: "rgba(80,175,149,0.1)", color: "#50AF95" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-6"
                style={{ color: "#FAFAFA" }}
              >
                Choosing the Right T402 SDK
              </h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: "#A1A1AA" }}>
                <span>January 25, 2026</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
                <span>T402 Team</span>
              </div>
            </div>
          </header>

          {/* Light Article Body */}
          <section style={{ backgroundColor: "#F7FAF9" }} className="py-16 md:py-20">
            <div className="max-w-3xl mx-auto px-6 space-y-10" style={{ lineHeight: "1.8" }}>
              {/* TL;DR */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <p className="text-base" style={{ color: "#4A5568" }}>
                  <strong style={{ color: "#1A1A2E" }}>TL;DR</strong>: T402 offers official SDKs in TypeScript, Python, Go, and Java. All SDKs support the same 44 networks and payment schemes. Choose TypeScript for web apps, Python for AI/ML, Go for high-performance services, and Java for enterprise systems.
                </p>
              </div>

              {/* Overview */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Overview</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  T402 provides four official SDKs to match your technology stack. Each SDK implements the full T402 protocol specification, supporting all 44 networks across 10 families with identical payment flows.
                </p>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  The core functionality is consistent across all SDKs: create payment requirements, sign payment payloads, verify signatures, and settle on-chain. The difference lies in language idioms, ecosystem integration, and performance characteristics.
                </p>
              </section>

              {/* SDK Cards */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>SDK Comparison</h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {sdks.map((sdk) => (
                    <SdkCard key={sdk.name} sdk={sdk} />
                  ))}
                </div>
              </section>

              {/* Feature Matrix */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Feature Matrix</h2>
                <div className="overflow-x-auto">
                  <table
                    className="w-full min-w-[600px] border-collapse text-sm"
                    style={{ color: "#4A5568" }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <th className="py-3 pr-4 text-left font-medium" style={{ color: "#A1A1AA" }}>Feature</th>
                        <th className="px-4 py-3 text-center font-medium" style={{ color: "#1A1A2E" }}>TypeScript</th>
                        <th className="px-4 py-3 text-center font-medium" style={{ color: "#1A1A2E" }}>Python</th>
                        <th className="px-4 py-3 text-center font-medium" style={{ color: "#1A1A2E" }}>Go</th>
                        <th className="px-4 py-3 text-center font-medium" style={{ color: "#1A1A2E" }}>Java</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <td className="py-3 pr-4">Supported Chains</td>
                        <td className="px-4 py-3 text-center">44</td>
                        <td className="px-4 py-3 text-center">44</td>
                        <td className="px-4 py-3 text-center">44</td>
                        <td className="px-4 py-3 text-center">44</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <td className="py-3 pr-4">HTTP Middleware</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Express, Hono, Fastify, Next.js</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>FastAPI, Flask</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Gin, Echo</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Spring Boot</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <td className="py-3 pr-4">MCP Server</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Yes (11 tools)</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Yes (6 tools)</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Yes (6 tools)</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>Yes (6 tools)</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                        <td className="py-3 pr-4">CLI Tool</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>@t402/cli</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>t402 CLI</td>
                        <td className="px-4 py-3 text-center" style={{ color: "#50AF95" }}>t402 binary</td>
                        <td className="px-4 py-3 text-center">N/A</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
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
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Recommendations</h2>
                {[
                  {
                    title: "Choose TypeScript if...",
                    items: [
                      "You\u2019re building a web application (React, Vue, Next.js)",
                      "You want the most complete ecosystem with 36 packages",
                      "You need React/Vue components for payment UIs",
                      "You\u2019re deploying to serverless platforms (Vercel, Cloudflare Workers)",
                    ],
                  },
                  {
                    title: "Choose Python if...",
                    items: [
                      "You\u2019re building AI/ML services that need payment capabilities",
                      "Your backend is FastAPI or Flask",
                      "You want easy integration with data science workflows",
                      "You prefer async/await with native asyncio support",
                    ],
                  },
                  {
                    title: "Choose Go if...",
                    items: [
                      "Performance is critical (high-throughput APIs)",
                      "You\u2019re building microservices or infrastructure",
                      "You want a single static binary deployment",
                      "You need the lowest memory footprint",
                    ],
                  },
                  {
                    title: "Choose Java if...",
                    items: [
                      "You\u2019re in an enterprise environment with existing Java infrastructure",
                      "You\u2019re using Spring Boot or Jakarta EE",
                      "You need JVM ecosystem compatibility (Kotlin, Scala)",
                      "You\u2019re building Android applications",
                    ],
                  },
                ].map((rec) => (
                  <div
                    key={rec.title}
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    <h3 className="text-lg font-semibold mb-2" style={{ color: "#1A1A2E" }}>{rec.title}</h3>
                    <ul className="list-disc pl-5 space-y-1" style={{ color: "#4A5568" }}>
                      {rec.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              {/* Get Started */}
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold mt-4" style={{ color: "#1A1A2E" }}>Get Started</h2>
                <p className="text-base" style={{ color: "#4A5568" }}>
                  All T402 SDKs are open source and available on their respective package registries. Start accepting stablecoin payments in minutes:
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/sdks"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#50AF95", color: "#0A0A0B" }}
                  >
                    View All SDKs
                    <ArrowRightIcon />
                  </Link>
                  <Link
                    href="https://docs.t402.io/getting-started/quickstart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-medium transition-all hover:opacity-90"
                    style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E", border: "1px solid rgba(0,0,0,0.08)" }}
                  >
                    Read Documentation
                  </Link>
                </div>
              </section>
            </div>
          </section>
        </article>
      </div>

      <Footer />
    </div>
  );
}
