# Services

This directory contains web services for the t402 ecosystem.

| Service | Description | Port | Status |
|---------|-------------|------|--------|
| `site/` | Marketing website ([t402.io](https://t402.io)) | 3010 | ✅ Production (Docker + Cloudflare Tunnel) |
| `docs/` | Documentation ([docs.t402.io](https://docs.t402.io)) | 3011 | ✅ Production (Docker + Cloudflare Tunnel) |
| `demo/` | Interactive demo, 9 scenarios ([demo.t402.io](https://demo.t402.io)) | 3012 | ✅ Production (Docker + Cloudflare Tunnel) |
| `facilitator/` | Payment verification + settlement (Go) | 8080 | ✅ Production |
| `scan2pay/` | Merchant payment gateway (Java + Next.js) | 8081/3001 | ✅ Production |
| `bazaar/` | Service marketplace for AI agents | 3402 | 🆕 New |
| `status/` | Public health monitoring + status page | 3403 | 🆕 New |
| `explorer/` | Payment transaction explorer | 3404 | 🆕 New |
| `agent-dashboard/` | AI agent payment monitoring UI | 3405 | 🆕 New |
| `sandbox/` | Public testnet facilitator for developers | 8080 | 🆕 New |

The `facilitator` and `scan2pay` services are private submodules.

## Architecture

```
Internet
  └── Cloudflare Tunnel
        ├── t402.io → site/:3010
        ├── docs.t402.io → docs/:3011
        ├── demo.t402.io → demo/:3012
        ├── facilitator.t402.io → facilitator/:8080
        ├── scan2pay.t402.io → scan2pay/service/:3001
        ├── scan2pay-api.t402.io → scan2pay/api/:8081
        ├── bazaar.t402.io → bazaar/:3402
        ├── status.t402.io → status/:3403
        ├── explorer.t402.io → explorer/:3404
        ├── agents.t402.io → agent-dashboard/:3405
        └── sandbox.t402.io → sandbox/:8080
```
