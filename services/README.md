# Services

This directory contains web services for the t402 ecosystem.

| Service | Description | Port | Status |
|---------|-------------|------|--------|
| `site/` | Marketing website ([t402.io](https://t402.io)) | — | ✅ Production (Vercel) |
| `docs/` | Documentation ([docs.t402.io](https://docs.t402.io)) | — | ✅ Production (Vercel) |
| `demo/` | Interactive demo, 9 scenarios ([demo.t402.io](https://demo.t402.io)) | — | ✅ Production (Vercel) |
| `facilitator/` | Payment verification + settlement (Go) | 8080 | ✅ Production |
| `scan2pay/` | Merchant payment gateway (Java + Next.js) | 8081/3001 | ✅ Production |
| `bazaar/` | Service marketplace for AI agents | 3402 | 🆕 New |
| `status/` | Public status page with health checks | 3403 | 🆕 New |
| `explorer/` | Payment transaction explorer | 3404 | 🆕 New |

The `facilitator` and `scan2pay` services are private submodules.
