# @t402/payments-mcp

> One-command t402 payment client for AI agents

```bash
npx @t402/payments-mcp
```

Auto-detects and configures for Claude Code, Claude Desktop, Codex, and Gemini.

## What It Does

1. Detects your AI client (Claude, Codex, Gemini)
2. Configures the t402 MCP payment server
3. Gives your AI agent 32+ payment tools
4. Your agent can now discover, pay for, and receive web resources

## After Setup

Ask your AI agent:

```
"Check my USDC balance on Base"
"Pay 5 USDC to 0x... on Arbitrum"
"Fetch https://paid-api.example.com/data (it may require payment)"
```

The `t402/autoPay` tool handles the entire 402 payment flow automatically.

## Supported

- **25 EVM chains** + Solana + TON + TRON + 10 more
- **Tokens**: USDT, USDC, USDT0, USAT
- **32+ MCP tools**: balance, pay, bridge, swap, sign, verify, price, observe
