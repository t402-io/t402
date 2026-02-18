/**
 * t402 MCP Chatbot Example
 *
 * Interactive CLI that demonstrates the t402 MCP payment tools in demo mode.
 * Maps user input to tool calls for balances, payments, and bridging.
 *
 * Run with: pnpm start
 */

import * as readline from "readline";
import {
  executeGetBalance,
  executeGetAllBalances,
  executePay,
  executeGetBridgeFee,
  formatBalanceResult,
  formatAllBalancesResult,
  formatPaymentResult,
  formatBridgeFeeResult,
  TOOL_DEFINITIONS,
  WDK_TOOL_DEFINITIONS,
} from "@t402/mcp";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(): Promise<string> {
  return new Promise((resolve) => {
    rl.question("\n> ", (answer) => resolve(answer.trim()));
  });
}

function printHelp(): void {
  console.log(`
t402 MCP Chatbot (Demo Mode)
=============================

Commands:
  balance <address> <network>         Check balance on a network
  all-balances <address>              Check balances across all networks
  pay <amount> <token> to <address> on <network>   Send a payment
  fee <fromChain> to <toChain> <amount>            Get bridge fee quote
  tools                               List available MCP tools
  help                                Show this help
  quit                                Exit

Networks: ethereum, base, arbitrum, optimism, polygon, avalanche, ink, berachain, unichain
Tokens: USDC, USDT, USDT0

All operations run in demo mode - no real transactions are executed.
`);
}

function listTools(): void {
  console.log("\nBase Tools (always available):");
  for (const [name, tool] of Object.entries(TOOL_DEFINITIONS)) {
    console.log(`  ${name} - ${tool.description.slice(0, 80)}...`);
  }
  console.log("\nWDK Tools (requires seed phrase):");
  for (const [name, tool] of Object.entries(WDK_TOOL_DEFINITIONS)) {
    console.log(`  ${name} - ${tool.description.slice(0, 80)}...`);
  }
}

async function handleBalance(parts: string[]): Promise<void> {
  const address = parts[1];
  const network = parts[2] || "ethereum";

  if (!address) {
    console.log("Usage: balance <address> <network>");
    return;
  }

  console.log(`Checking balance on ${network}...`);
  const result = await executeGetBalance({ network, address });
  console.log(formatBalanceResult(result));
}

async function handleAllBalances(parts: string[]): Promise<void> {
  const address = parts[1];

  if (!address) {
    console.log("Usage: all-balances <address>");
    return;
  }

  console.log("Checking balances across all networks...");
  const result = await executeGetAllBalances({ address });
  console.log(formatAllBalancesResult(result));
}

async function handlePay(input: string): Promise<void> {
  // Parse: pay <amount> <token> to <address> on <network>
  const match = input.match(
    /^pay\s+(\S+)\s+(\S+)\s+to\s+(0x[a-fA-F0-9]{40})\s+on\s+(\S+)/i
  );

  if (!match) {
    console.log("Usage: pay <amount> <token> to <address> on <network>");
    console.log("Example: pay 10 USDC to 0x1234...5678 on base");
    return;
  }

  const [, amount, token, to, network] = match;
  console.log(`Sending ${amount} ${token} to ${to} on ${network}...`);

  const result = await executePay(
    { to, amount, token: token.toUpperCase(), network },
    { privateKey: "0x", demoMode: true }
  );
  console.log(formatPaymentResult(result));
  console.log("\n(Demo mode - no real tokens transferred)");
}

async function handleBridgeFee(parts: string[]): Promise<void> {
  // Parse: fee <fromChain> to <toChain> <amount>
  const fromChain = parts[1];
  const toChain = parts[3]; // skip "to"
  const amount = parts[4] || "100";

  if (!fromChain || !toChain) {
    console.log("Usage: fee <fromChain> to <toChain> <amount>");
    console.log("Example: fee arbitrum to ethereum 100");
    return;
  }

  const demoRecipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  console.log(`Getting bridge fee for ${amount} USDT0: ${fromChain} -> ${toChain}...`);

  const result = await executeGetBridgeFee({
    fromChain,
    toChain,
    amount,
    recipient: demoRecipient,
  });
  console.log(formatBridgeFeeResult(result));
}

async function main(): Promise<void> {
  console.log("t402 MCP Chatbot (Demo Mode)");
  console.log('Type "help" for commands, "quit" to exit.\n');

  while (true) {
    const input = await prompt();

    if (!input) continue;

    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case "balance":
          await handleBalance(parts);
          break;
        case "all-balances":
          await handleAllBalances(parts);
          break;
        case "pay":
          await handlePay(input);
          break;
        case "fee":
          await handleBridgeFee(parts);
          break;
        case "tools":
          listTools();
          break;
        case "help":
          printHelp();
          break;
        case "quit":
        case "exit":
          console.log("Goodbye!");
          rl.close();
          process.exit(0);
        default:
          console.log(`Unknown command: ${command}. Type "help" for available commands.`);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

main().catch(console.error);
