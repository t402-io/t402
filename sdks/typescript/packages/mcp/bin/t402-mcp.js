#!/usr/bin/env node

/**
 * t402 MCP Server CLI
 *
 * Run the t402 MCP server for Claude Desktop and other AI agents.
 *
 * Usage:
 *   npx @t402/mcp
 *   t402-mcp
 *
 * Environment Variables:
 *   T402_PRIVATE_KEY   - Wallet private key (hex with 0x prefix)
 *   T402_DEMO_MODE     - Set to "true" to simulate transactions
 *   T402_BUNDLER_URL   - ERC-4337 bundler URL for gasless transactions
 *   T402_PAYMASTER_URL - Paymaster URL for gasless transactions
 *   T402_WDK_SEED_PHRASE - WDK seed phrase (enables wallet tools)
 *   T402_WDK_CHAINS    - Comma-separated chains for WDK (default: ethereum,arbitrum,base)
 *   T402_RPC_ETHEREUM  - Custom RPC URL for Ethereum
 *   T402_RPC_BASE      - Custom RPC URL for Base
 *   T402_RPC_ARBITRUM  - Custom RPC URL for Arbitrum
 *   ... (other networks follow same pattern)
 */

import { createT402McpServer, loadConfigFromEnv } from '../dist/esm/index.mjs'

async function main() {
  const config = loadConfigFromEnv()

  // Log configuration status (to stderr so it doesn't interfere with stdio)
  console.error('t402 MCP Server Configuration:')
  console.error(`  Private Key: ${config.privateKey ? 'configured' : 'not set'}`)
  console.error(`  Demo Mode: ${config.demoMode ? 'enabled' : 'disabled'}`)
  console.error(`  Bundler URL: ${config.bundlerUrl ? 'configured' : 'not set'}`)
  console.error(`  Paymaster URL: ${config.paymasterUrl ? 'configured' : 'not set'}`)
  console.error(`  WDK Seed Phrase: ${config.seedPhrase ? 'configured' : 'not set'}`)
  console.error(`  WDK Chains: ${config.wdkChains ? config.wdkChains.join(', ') : 'default (ethereum, arbitrum, base)'}`)

  if (config.rpcUrls) {
    console.error(`  Custom RPC URLs: ${Object.keys(config.rpcUrls).join(', ')}`)
  }

  if (config.seedPhrase || config.demoMode) {
    console.error('  WDK Tools: enabled (wdk/getWallet, wdk/getBalances, wdk/transfer, wdk/swap, t402/autoPay)')
  } else {
    console.error('  WDK Tools: disabled (set T402_WDK_SEED_PHRASE to enable)')
  }

  if (!config.privateKey && !config.demoMode && !config.seedPhrase) {
    console.error('')
    console.error('Warning: No private key or seed phrase configured.')
    console.error('Set T402_PRIVATE_KEY or T402_WDK_SEED_PHRASE env var, or enable T402_DEMO_MODE=true')
    console.error('')
  }

  const server = createT402McpServer(config)
  await server.run()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
