"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const languages = [
  { id: "typescript", label: "TypeScript", extension: ".ts" },
  { id: "python", label: "Python", extension: ".py" },
  { id: "go", label: "Go", extension: ".go" },
  { id: "java", label: "Java", extension: ".java" },
];

const codeExamples: Record<string, { server: string; client: string }> = {
  typescript: {
    server: `import { paymentMiddleware } from "@t402/express";
import express from "express";

const app = express();

// Protect any endpoint with USDT payments
app.use(paymentMiddleware({
  "GET /api/premium": {
    price: "$1.00",
    network: "eip155:8453",  // Base
    payTo: "0x..."
  }
}));

app.get("/api/premium", (req, res) => {
  res.json({ data: "Premium content" });
});`,
    client: `import { wrapFetchWithPayment } from "@t402/fetch";
import { registerExactEvmScheme } from "@t402/evm";

// Register payment mechanism
const client = new t402Client();
registerExactEvmScheme(client, { signer });

// Wrap fetch for automatic payments
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Make request - payment handled automatically
const response = await fetchWithPayment(
  "https://api.example.com/api/premium"
);`,
  },
  python: {
    server: `from t402 import T402Middleware
from fastapi import FastAPI

app = FastAPI()

# Add payment middleware
middleware = T402Middleware(
    amount="1.00",        # $1.00 USDT
    recipient="0x...",    # Your wallet
    network="eip155:8453" # Base
)

@app.get("/api/premium")
@middleware.protect
async def premium_content():
    return {"data": "Premium content"}`,
    client: `from t402 import T402Client

# Initialize with wallet
client = T402Client(
    private_key="...",
    network="eip155:8453"  # Base
)

# Make authenticated request
response = await client.fetch(
    "https://api.example.com/api/premium"
)

# Payment handled automatically`,
  },
  go: {
    server: `package main

import (
    "net/http"
    t402 "github.com/t402-io/t402/go"
)

func main() {
    // Create payment middleware
    middleware := t402.NewMiddleware(t402.Config{
        Amount:    "1.00",
        Recipient: "0x...",
        Network:   "eip155:8453",  // Base
    })

    // Protect endpoint
    http.Handle("/api/premium",
        middleware.Wrap(premiumHandler))
}`,
    client: `package main

import (
    t402 "github.com/t402-io/t402/go"
)

func main() {
    // Initialize client
    client := t402.NewClient(t402.ClientConfig{
        PrivateKey: "...",
        Network:    "eip155:8453",  // Base
    })

    // Make authenticated request
    resp, _ := client.Fetch(
        "https://api.example.com/api/premium",
    )
    // Payment handled automatically
}`,
  },
  java: {
    server: `import io.t402.spring.EnableT402;
import io.t402.spring.T402Payment;

@EnableT402
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}

@RestController
public class PremiumController {
    @T402Payment(amount = "1.00", network = "eip155:8453")
    @GetMapping("/api/premium")
    public Map<String, String> premium() {
        return Map.of("data", "Premium content");
    }
}`,
    client: `import io.t402.client.T402HttpClient;

// Initialize client
T402HttpClient client = new T402HttpClient.Builder()
    .privateKey("...")
    .network("eip155:8453")  // Base
    .build();

// Make authenticated request
HttpResponse<String> response = client.get(
    "https://api.example.com/api/premium"
);

// Payment handled automatically`,
  },
};

function CopyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CodeBlock({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-xs text-foreground-tertiary">
          {filename}
        </span>
        <button
          onClick={handleCopy}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-tertiary transition-colors hover:bg-background-tertiary hover:text-foreground"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-success" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto border-none bg-transparent p-4">
        <code className="bg-transparent font-mono text-sm leading-relaxed text-foreground-secondary">
          {code}
        </code>
      </pre>
    </div>
  );
}

export function CodeExamples() {
  const [activeLanguage, setActiveLanguage] = useState("typescript");
  const [activeTab, setActiveTab] = useState<"server" | "client">("server");

  const currentExample = codeExamples[activeLanguage];
  const currentLang = languages.find((l) => l.id === activeLanguage);

  return (
    <section className="relative py-24">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(80, 175, 149, 0.1), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple Integration
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-secondary">
            Add USDT payments to your API in minutes with our SDKs for
            TypeScript, Python, Go, and Java.
          </p>
        </motion.div>

        {/* Language Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12 flex justify-center"
        >
          <div className="inline-flex gap-1 rounded-lg border border-border bg-background-secondary p-1">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setActiveLanguage(lang.id)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeLanguage === lang.id
                    ? "bg-background-tertiary text-foreground"
                    : "text-foreground-secondary hover:text-foreground"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Code Examples */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8"
        >
          <div className="mx-auto max-w-5xl">
            {/* Server/Client Tabs */}
            <div className="mb-4 flex gap-4">
              <button
                onClick={() => setActiveTab("server")}
                className={`text-sm font-medium transition-colors ${
                  activeTab === "server"
                    ? "text-brand"
                    : "text-foreground-tertiary hover:text-foreground-secondary"
                }`}
              >
                Server-side
              </button>
              <button
                onClick={() => setActiveTab("client")}
                className={`text-sm font-medium transition-colors ${
                  activeTab === "client"
                    ? "text-brand"
                    : "text-foreground-tertiary hover:text-foreground-secondary"
                }`}
              >
                Client-side
              </button>
            </div>

            {/* Code Block */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeLanguage}-${activeTab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CodeBlock
                  code={currentExample[activeTab]}
                  filename={`${activeTab}${currentLang?.extension}`}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Install Command */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="mb-4 text-sm text-foreground-tertiary">
            Install the SDK
          </p>
          <div className="mx-auto inline-flex items-center gap-3 rounded-lg border border-border bg-background-secondary px-4 py-3">
            <span className="font-mono text-sm text-foreground-secondary">
              {activeLanguage === "typescript" && "npm install @t402/express @t402/fetch"}
              {activeLanguage === "python" && "pip install t402"}
              {activeLanguage === "go" && "go get github.com/t402-io/t402/go"}
              {activeLanguage === "java" && "io.t402:t402-spring-boot-starter:1.1.0"}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
