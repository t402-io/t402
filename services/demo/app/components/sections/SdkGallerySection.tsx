"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Copy, Check } from "lucide-react";

interface SdkExample {
  lang: string;
  color: string;
  registry: string;
  frameworks: {
    server: Array<{ name: string; install: string; code: string }>;
    client: Array<{ name: string; install: string; code: string }>;
  };
}

const sdkExamples: SdkExample[] = [
  {
    lang: "TypeScript",
    color: "#3178C6",
    registry: "npm (21 packages)",
    frameworks: {
      server: [
        {
          name: "Express",
          install: "npm install @t402/express @t402/evm",
          code: `import { paymentMiddleware } from "@t402/express";
import { ExactEvmServer } from "@t402/evm/exact/server";

app.use(paymentMiddleware({
  "GET /api/data": {
    price: "$0.01",
    network: "eip155:8453",
    schemes: [new ExactEvmServer({
      payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
    })],
  },
}));`,
        },
        {
          name: "Hono",
          install: "npm install @t402/hono @t402/evm",
          code: `import { paymentMiddleware } from "@t402/hono";
import { ExactEvmServer } from "@t402/evm/exact/server";

app.use("/api/data", paymentMiddleware({
  price: "$0.01",
  network: "eip155:8453",
  schemes: [new ExactEvmServer({
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
  })],
}));`,
        },
        {
          name: "Next.js",
          install: "npm install @t402/next @t402/evm",
          code: `import { withT402 } from "@t402/next";
import { ExactEvmServer } from "@t402/evm/exact/server";

export const GET = withT402(handler, {
  price: "$0.01",
  network: "eip155:8453",
  schemes: [new ExactEvmServer({
    payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
  })],
});`,
        },
        {
          name: "Fastify",
          install: "npm install @t402/fastify @t402/evm",
          code: `import { t402Plugin } from "@t402/fastify";
import { ExactEvmServer } from "@t402/evm/exact/server";

fastify.register(t402Plugin, {
  routes: {
    "GET /api/data": {
      price: "$0.01",
      network: "eip155:8453",
      schemes: [new ExactEvmServer({
        payTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
      })],
    },
  },
});`,
        },
      ],
      client: [
        {
          name: "Fetch",
          install: "npm install @t402/fetch @t402/evm",
          code: `import { wrapFetchWithPayment } from "@t402/fetch";
import { t402Client } from "@t402/core/client";
import { registerExactEvmScheme } from "@t402/evm/exact/client";

const client = new t402Client();
registerExactEvmScheme(client, { signer: walletClient });

const paidFetch = wrapFetchWithPayment(fetch, client);

// Automatically handles 402 → sign → retry
const res = await paidFetch("/api/data");
const data = await res.json();`,
        },
        {
          name: "Axios",
          install: "npm install @t402/axios @t402/evm",
          code: `import { createPaymentInterceptor } from "@t402/axios";
import { t402Client } from "@t402/core/client";
import { registerExactEvmScheme } from "@t402/evm/exact/client";

const client = new t402Client();
registerExactEvmScheme(client, { signer: walletClient });

const axios = createPaymentInterceptor(baseAxios, client);

// Automatically handles 402 → sign → retry
const { data } = await axios.get("/api/data");`,
        },
      ],
    },
  },
  {
    lang: "Python",
    color: "#3776AB",
    registry: "PyPI",
    frameworks: {
      server: [{
        name: "FastAPI",
        install: "pip install t402",
        code: `from t402 import payment_required, ExactEvmScheme

@app.get("/api/data")
@payment_required(
    price="$0.01",
    network="eip155:8453",
    scheme=ExactEvmScheme(
        pay_to="0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
    )
)
async def get_data():
    return {"data": "premium content"}`,
      }],
      client: [{
        name: "httpx",
        install: "pip install t402",
        code: `from t402 import T402Client, EvmSigner

client = T402Client(
    signer=EvmSigner(private_key=os.environ["KEY"])
)

# Automatically handles 402 → sign → retry
response = client.get("https://api.example.com/data")
data = response.json()`,
      }],
    },
  },
  {
    lang: "Go",
    color: "#00ADD8",
    registry: "Go Modules",
    frameworks: {
      server: [{
        name: "net/http",
        install: "go get github.com/t402-io/t402/sdks/go",
        code: `import "github.com/t402-io/t402/sdks/go"
import "github.com/t402-io/t402/sdks/go/mechanisms/evm"

mux.Handle("GET /api/data", t402.PaymentMiddleware(
    handler,
    t402.WithPrice("$0.01"),
    t402.WithNetwork("eip155:8453"),
    t402.WithScheme(evm.NewExactServer(evm.Config{
        PayTo: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    })),
))`,
      }],
      client: [{
        name: "http.Client",
        install: "go get github.com/t402-io/t402/sdks/go",
        code: `import "github.com/t402-io/t402/sdks/go"

client := t402.NewClient(
    t402.WithEvmSigner(privateKey),
)

// Automatically handles 402 → sign → retry
resp, err := client.Get("https://api.example.com/data")`,
      }],
    },
  },
  {
    lang: "Java",
    color: "#ED8B00",
    registry: "Maven Central",
    frameworks: {
      server: [{
        name: "Spring Boot",
        install: "implementation 'io.t402:t402:1.8.0'",
        code: `@PaymentRequired(
    price = "$0.01",
    network = "eip155:8453",
    payTo = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
)
@GetMapping("/api/data")
public ResponseEntity<Data> getData() {
    return ResponseEntity.ok(premiumData);
}`,
      }],
      client: [{
        name: "OkHttp",
        install: "implementation 'io.t402:t402:1.8.0'",
        code: `T402Client client = T402Client.builder()
    .signer(new EvmSigner(privateKey))
    .build();

// Automatically handles 402 → sign → retry
Response response = client.get(
    "https://api.example.com/data"
);`,
      }],
    },
  },
];

export default function SdkGallerySection() {
  const [activeLang, setActiveLang] = useState(0);
  const [view, setView] = useState<"server" | "client">("server");
  const [serverTab, setServerTab] = useState(0);
  const [clientTab, setClientTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const sdk = sdkExamples[activeLang];
  const frameworks = view === "server" ? sdk.frameworks.server : sdk.frameworks.client;
  const activeTab = view === "server" ? serverTab : clientTab;
  const framework = frameworks[Math.min(activeTab, frameworks.length - 1)];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* Language cards */}
      <div className="flex gap-3 mb-5">
        {sdkExamples.map((sdk, i) => (
          <button
            key={sdk.lang}
            onClick={() => { setActiveLang(i); setServerTab(0); setClientTab(0); }}
            className={`relative flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
              activeLang === i
                ? "border-white/10 bg-white/5"
                : "border-[var(--color-border)] hover:border-white/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: sdk.color }} />
              <span className="text-sm font-medium text-white">{sdk.lang}</span>
            </div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">{sdk.registry}</div>
            {activeLang === i && (
              <motion.div
                layoutId="sdk-active"
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ backgroundColor: sdk.color }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Install bar */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-2.5">
        <code className="text-sm text-[var(--color-brand)]">$ {framework.install}</code>
        <button
          onClick={() => handleCopy(framework.install)}
          className="text-xs text-[var(--color-muted)] hover:text-white transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      {/* Server/Client toggle + framework tabs */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
          <button
            onClick={() => setView("server")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "server" ? "bg-white/10 text-white" : "text-[var(--color-muted)]"
            }`}
          >
            Server
          </button>
          <button
            onClick={() => setView("client")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "client" ? "bg-white/10 text-white" : "text-[var(--color-muted)]"
            }`}
          >
            Client
          </button>
        </div>

        {frameworks.length > 1 && (
          <div className="flex gap-1">
            {frameworks.map((fw, i) => (
              <button
                key={fw.name}
                onClick={() => view === "server" ? setServerTab(i) : setClientTab(i)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === i ? "bg-white/10 text-white" : "text-[var(--color-muted)] hover:text-white"
                }`}
              >
                {fw.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Code block */}
      <div className="flex-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
          <span className="text-xs" style={{ color: sdk.color }}>
            {framework.name} — {view === "server" ? "Server" : "Client"}
          </span>
          <button
            onClick={() => handleCopy(framework.code)}
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-white transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            Copy
          </button>
        </div>
        <pre className="overflow-auto p-5 text-[var(--text-code)] leading-relaxed text-gray-300 h-full">
          <code>{framework.code}</code>
        </pre>
      </div>
    </div>
  );
}
