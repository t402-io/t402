# T402 Documentation Site

Documentation site for the T402 payment protocol, deployed at [docs.t402.io](https://docs.t402.io).

## Tech Stack

- **Framework**: Next.js 14 with static export
- **Documentation**: Nextra 3.0 (MDX-based documentation generator)
- **Styling**: Tailwind CSS 3.4
- **Search**: Nextra built-in search (Algolia DocSearch optional)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production (static export)
pnpm build

# Build with API docs generation
pnpm build:full
```

## Structure

```
services/docs/
├── pages/           # MDX documentation pages
│   ├── index.mdx    # Home page
│   ├── getting-started/
│   ├── tutorials/
│   ├── sdks/        # SDK documentation (TypeScript, Go, Python, Java)
│   ├── chains/      # Chain-specific docs
│   ├── reference/   # API reference
│   ├── advanced/    # Advanced features
│   └── _meta.ts     # Navigation configuration
├── public/          # Static assets (images, favicons)
├── styles/          # Custom CSS
├── scripts/         # Build scripts (API doc generation)
├── theme.config.tsx # Nextra theme configuration
├── next.config.mjs  # Next.js configuration
└── internal/        # [SUBMODULE:PRIVATE] Internal documents
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_ALGOLIA_APP_ID` | Algolia application ID | No |
| `NEXT_PUBLIC_ALGOLIA_API_KEY` | Algolia search-only API key | No |
| `NEXT_PUBLIC_ALGOLIA_INDEX_NAME` | Algolia index name (default: `t402_docs`) | No |

## Deployment

The site is built as a static export and can be deployed to any static hosting provider (Vercel, Netlify, Cloudflare Pages).

```bash
# Build produces static files in out/
pnpm build
```

## Content Guidelines

- Documentation pages use MDX format (Markdown + JSX)
- Navigation is configured via `_meta.ts` files in each directory
- Use Nextra's `Tabs`, `Cards`, `Callout` components (accessed as `Tabs.Tab`, `Cards.Card`)
- Code blocks support syntax highlighting and copy-to-clipboard
