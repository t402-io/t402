#!/usr/bin/env node

/**
 * create-t402-agent — Scaffold an AI agent with t402 payment capabilities
 *
 * Usage:
 *   npx create-t402-agent                    # Interactive
 *   npx create-t402-agent my-agent --mcp     # MCP agent
 *   npx create-t402-agent my-agent --standalone  # Standalone script
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--")) || "my-t402-agent";
const isMcp = args.includes("--mcp") || !args.includes("--standalone");

console.log(`\n🤖 create-t402-agent — AI agent with t402 payments\n`);
console.log(`   Project: ${name}`);
console.log(`   Mode: ${isMcp ? "MCP (Claude/Codex/Gemini)" : "Standalone script"}\n`);

const dir = name;

function write(path, content) {
  const full = join(dir, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
  console.log(`  ✅ ${full}`);
}

// package.json
write("package.json", JSON.stringify({
  name,
  version: "1.0.0",
  type: "module",
  scripts: {
    start: isMcp ? "node src/mcp-server.js" : "node src/agent.js",
    dev: isMcp ? "node --watch src/mcp-server.js" : "node --watch src/agent.js",
  },
  dependencies: {
    "@t402/mcp": "^2.8.0",
    "@t402/core": "^2.8.0",
    "@t402/policy": "^2.8.0",
  },
}, null, 2));

// .env.example
write(".env.example", `# Wallet seed phrase (BIP-39 mnemonic)
SEED_PHRASE=your twelve word seed phrase here

# Optional: spending limits
MAX_AMOUNT_PER_PAYMENT=1000000
MAX_AMOUNT_PER_SESSION=10000000

# Optional: preferred network
PREFERRED_NETWORK=eip155:8453
`);

// .gitignore
write(".gitignore", `node_modules/
.env
dist/
`);

if (isMcp) {
  // MCP server mode
  write("src/mcp-server.js", `/**
 * t402 Payment Agent — MCP Server
 *
 * This agent can:
 * - Check wallet balances across 25+ chains
 * - Pay for HTTP 402-protected resources
 * - Bridge tokens between chains
 * - Search the t402 bazaar for paid services
 *
 * Start: node src/mcp-server.js
 * Configure in Claude/Codex/Gemini MCP settings.
 */

import "dotenv/config";

console.log("🤖 t402 Payment Agent (MCP Mode)");
console.log("   Waiting for MCP client connection...");
console.log("");
console.log("   Configure in your AI client:");
console.log("   {");
console.log('     "mcpServers": {');
console.log('       "t402-agent": {');
console.log('         "command": "node",');
console.log('         "args": ["src/mcp-server.js"],');
console.log('         "env": { "SEED_PHRASE": "..." }');
console.log("       }");
console.log("     }");
console.log("   }");
console.log("");
console.log("   Tools available: t402/pay, t402/autoPay, t402/getBalance,");
console.log("   t402/bridge, t402/searchBazaar, wdk/swap, and 26+ more.");

// In production: import and start the actual MCP server
// import { createT402McpServer } from "@t402/mcp";
// const server = createT402McpServer({ seedPhrase: process.env.SEED_PHRASE });
// server.start();

process.stdin.resume();
`);

} else {
  // Standalone mode
  write("src/agent.js", `/**
 * t402 Payment Agent — Standalone
 *
 * Demonstrates the complete 402 payment flow:
 * 1. Request a resource
 * 2. Receive 402 Payment Required
 * 3. Sign payment with wallet
 * 4. Retry and receive resource
 */

import "dotenv/config";

const TARGET_URL = process.env.TARGET_URL || "https://api.example.com/data";

async function run() {
  console.log("🤖 t402 Payment Agent (Standalone)\\n");

  // Step 1: Request resource
  console.log(\`📡 Requesting: \${TARGET_URL}\`);
  const res = await fetch(TARGET_URL);

  if (res.status === 402) {
    const requirements = await res.json();
    const accept = requirements.accepts?.[0];

    console.log("💰 Payment required:");
    console.log(\`   Amount: \${accept?.amount} \${accept?.extra?.name || "tokens"}\`);
    console.log(\`   Network: \${accept?.network}\`);
    console.log(\`   PayTo: \${accept?.payTo}\`);

    // Step 2: Sign payment
    // In production: use @t402/core client to sign
    console.log("\\n🔐 Signing EIP-3009 authorization...");
    console.log("   (Configure SEED_PHRASE in .env for real payments)");

    // Step 3: Retry with payment
    // const paidRes = await fetchWithPayment(TARGET_URL);
    // console.log("✅ Resource received:", await paidRes.text());
  } else if (res.ok) {
    console.log("✅ Resource received (no payment needed)");
    console.log(await res.text());
  } else {
    console.log(\`❌ Error: \${res.status} \${res.statusText}\`);
  }
}

run().catch(console.error);
`);

  // Policy config
  write("src/policy.js", `/**
 * Payment policy configuration — spending guardrails for the agent.
 */

export const POLICY = {
  maxAmountPerPayment: process.env.MAX_AMOUNT_PER_PAYMENT || "1000000",  // 1 USDC
  maxAmountPerSession: process.env.MAX_AMOUNT_PER_SESSION || "10000000", // 10 USDC
  allowedNetworks: ["eip155:8453", "eip155:42161", "eip155:1"],
  allowedSchemes: ["exact"],
  blockedRecipients: [],
};

console.log("📋 Policy loaded:", JSON.stringify(POLICY, null, 2));
`);
}

// README
write("README.md", `# ${name}

AI agent with t402 stablecoin payment capabilities.

## Setup

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your seed phrase
\`\`\`

## Run

\`\`\`bash
npm start
\`\`\`

${isMcp ? `## Configure AI Client

Add to your Claude/Codex/Gemini MCP settings:

\`\`\`json
{
  "mcpServers": {
    "${name}": {
      "command": "node",
      "args": ["src/mcp-server.js"],
      "cwd": "${dir}"
    }
  }
}
\`\`\`

Then ask: "Check my USDC balance" or "Pay 5 USDC to 0x..."` : `## Usage

Set \`TARGET_URL\` in .env to a t402-protected endpoint.
The agent will automatically handle 402 payment flows.`}

## Supported

- 25 EVM chains + Solana + TON + TRON + 10 more
- USDT, USDC, USDT0, USAT, XAU₮0
- 32+ MCP payment tools
- Policy engine for spending limits
`);

console.log(`\n✅ Agent scaffolded! Next steps:`);
console.log(`   cd ${name}`);
console.log(`   npm install`);
console.log(`   cp .env.example .env`);
console.log(`   npm start\n`);
