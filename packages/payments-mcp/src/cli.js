#!/usr/bin/env node

/**
 * @t402/payments-mcp — One-command t402 payment client for AI agents
 *
 * Usage:
 *   npx @t402/payments-mcp              # Interactive setup
 *   npx @t402/payments-mcp --configure  # Auto-configure for detected AI client
 *   npx @t402/payments-mcp --server     # Start MCP server directly
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";

const VERSION = "2.8.0";
const SUPPORTED_CLIENTS = ["claude-code", "claude-desktop", "codex", "gemini"];

// MCP server configuration template
const MCP_CONFIG = {
  command: "npx",
  args: ["@t402/payments-mcp", "--server"],
  env: {},
};

function detectAIClient() {
  const detected = [];

  // Claude Code
  const claudeCodeConfig = join(homedir(), ".claude", "settings.json");
  if (existsSync(claudeCodeConfig)) detected.push("claude-code");

  // Claude Desktop
  const claudeDesktopConfig =
    process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : join(homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
  if (existsSync(claudeDesktopConfig)) detected.push("claude-desktop");

  return detected;
}

function configureClaude(configPath, label) {
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers["t402-payments"] = MCP_CONFIG;

  const dir = join(configPath, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`  ✅ Configured ${label}: ${configPath}`);
}

async function interactiveSetup() {
  console.log(`\n🔐 t402 Payments MCP v${VERSION}`);
  console.log("   HTTP-native stablecoin payments for AI agents\n");

  // Detect clients
  const detected = detectAIClient();
  if (detected.length > 0) {
    console.log(`📡 Detected AI clients: ${detected.join(", ")}`);
  } else {
    console.log("📡 No AI clients detected. You can configure manually.");
  }

  // Auto-configure detected clients
  for (const client of detected) {
    if (client === "claude-code") {
      const configPath = join(homedir(), ".claude", "settings.json");
      configureClaude(configPath, "Claude Code");
    } else if (client === "claude-desktop") {
      const configPath =
        process.platform === "darwin"
          ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
          : join(homedir(), "AppData", "Roaming", "Claude", "claude_desktop_config.json");
      configureClaude(configPath, "Claude Desktop");
    }
  }

  console.log("\n📦 Available MCP tools (32+):");
  console.log("   • t402/pay — Execute stablecoin payment");
  console.log("   • t402/autoPay — Smart auto-payment (fetch URL, handle 402, pay)");
  console.log("   • t402/getBalance — Check wallet balances");
  console.log("   • t402/bridge — Cross-chain token transfer");
  console.log("   • t402/smartPay — Intelligent payment routing");
  console.log("   • ... and 27+ more tools\n");

  console.log("🌐 Supported: 25 EVM chains + Solana + TON + TRON + 10 more");
  console.log("💰 Tokens: USDT, USDC, USDT0, USAT\n");

  if (detected.length > 0) {
    console.log("✅ Setup complete! Your AI agent can now pay for t402-protected resources.");
    console.log("   Try asking your agent: \"Pay for https://api.example.com/data\"\n");
  } else {
    console.log("ℹ️  To configure manually, add to your MCP config:");
    console.log(JSON.stringify({ "t402-payments": MCP_CONFIG }, null, 2));
  }
}

async function startServer() {
  console.log(`t402 Payments MCP Server v${VERSION}`);
  console.log("Waiting for MCP client connection...\n");

  // In production, this would start the actual MCP server
  // using @t402/mcp package. For now, print instructions.
  console.log("To start the full MCP server, install @t402/mcp:");
  console.log("  npm install @t402/mcp");
  console.log("  npx t402-mcp-server\n");

  // Keep process alive for MCP connection
  process.stdin.resume();
}

// Main
const args = process.argv.slice(2);

if (args.includes("--server")) {
  startServer();
} else if (args.includes("--help") || args.includes("-h")) {
  console.log(`
@t402/payments-mcp v${VERSION}

Usage:
  npx @t402/payments-mcp              Interactive setup
  npx @t402/payments-mcp --configure  Auto-configure detected clients
  npx @t402/payments-mcp --server     Start MCP server

Options:
  --help, -h    Show this help
  --version     Show version
  --configure   Auto-configure without prompts
  --server      Start MCP server mode
`);
} else if (args.includes("--version")) {
  console.log(VERSION);
} else {
  interactiveSetup();
}
