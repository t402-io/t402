# T402 Site

Marketing website for T402 - Open-source HTTP Payment Protocol for Stablecoins.

**Live site:** https://t402.io

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS 4
- **Deployment:** Docker + Cloudflare Tunnel (port 3010)
- **Package Manager:** pnpm

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Deployment

The site runs as a Docker container behind Cloudflare Tunnel on port 3010.

```bash
docker compose -f docker-compose.sites.yml build site
docker compose -f docker-compose.sites.yml up -d site
```

## Related Repositories

- [t402-io/t402](https://github.com/t402-io/t402) - Main monorepo with SDKs
- [T402 Documentation](https://docs.t402.io)
