# T402 Site

Marketing website for T402 - The Official Payment Protocol for USDT.

**Live site:** https://t402.io

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS 4
- **Deployment:** Cloudflare Pages (static export)
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

The site automatically deploys to Cloudflare Pages on push to `main` branch.

### Manual Deployment

```bash
pnpm build
wrangler pages deploy out --project-name t402-site
```

## Related Repositories

- [t402-io/t402](https://github.com/t402-io/t402) - Main monorepo with SDKs
- [T402 Documentation](https://docs.t402.io)
