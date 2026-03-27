# syntax=docker/dockerfile:1
#
# NOTE: This Dockerfile runs `pnpm build` (Nextra only), not `pnpm build:full`.
# TypeDoc API docs (public/api/) require the full TypeScript SDK monorepo and
# are generated in CI via `build:full` (see .github/workflows/docs.yml).
# For Docker builds, pre-generate API docs with `pnpm build:api` from the repo
# root, then build the image — the COPY step will include public/api/ if present.
#
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    # Redirects from old structure (10 sections → 6 sections)
    rewrite ^/tutorials/quick-start$ /getting-started/quickstart permanent;
    rewrite ^/tutorials/(.*)$ /guides/$1 permanent;
    rewrite ^/use-cases/api-monetization$ /guides/api-monetization permanent;
    rewrite ^/use-cases/micro-payments$ /guides/api-monetization permanent;
    rewrite ^/use-cases/ai-payments$ /guides/ai-agent-payments permanent;
    rewrite ^/use-cases/content-access$ /guides/ai-agent-payments permanent;
    rewrite ^/use-cases/?$ /guides permanent;
    rewrite ^/getting-started/installation$ /getting-started/quickstart permanent;
    rewrite ^/chains/?$ /resources/chains permanent;
    rewrite ^/chains/(.*)$ /resources/chains permanent;
    rewrite ^/schemes/?$ /resources/schemes permanent;
    rewrite ^/schemes/(.*)$ /resources/schemes permanent;
    rewrite ^/security/?$ /resources/security permanent;
    rewrite ^/security/(.*)$ /resources/security permanent;
    rewrite ^/ecosystem/?$ /resources/chains permanent;
    rewrite ^/ecosystem/(.*)$ /resources/chains permanent;
    rewrite ^/faq$ /resources/faq permanent;
    rewrite ^/glossary$ /resources/faq permanent;
    rewrite ^/comparison$ /resources/faq permanent;
    rewrite ^/changelog$ /resources/changelog permanent;
    rewrite ^/reference/near$ /reference/other-mechanisms permanent;
    rewrite ^/reference/aptos$ /reference/other-mechanisms permanent;
    rewrite ^/reference/tezos$ /reference/other-mechanisms permanent;
    rewrite ^/reference/polkadot$ /reference/other-mechanisms permanent;
    rewrite ^/reference/stacks$ /reference/other-mechanisms permanent;
    rewrite ^/reference/cosmos$ /reference/other-mechanisms permanent;
    rewrite ^/reference/btc$ /reference/other-mechanisms permanent;
    rewrite ^/reference/stellar$ /reference/other-mechanisms permanent;
    rewrite ^/reference/spark$ /reference/other-mechanisms permanent;
    rewrite ^/reference/express$ /reference/server-middleware permanent;
    rewrite ^/reference/hono$ /reference/server-middleware permanent;
    rewrite ^/reference/fastify$ /reference/server-middleware permanent;
    rewrite ^/reference/next$ /reference/server-middleware permanent;
    rewrite ^/reference/facilitator-embedded$ /reference/server-middleware permanent;
    rewrite ^/reference/fetch$ /reference/client-libraries permanent;
    rewrite ^/reference/axios$ /reference/client-libraries permanent;
    rewrite ^/reference/mcp$ /advanced/mcp permanent;
    rewrite ^/reference/a2a$ /reference/ai-agents permanent;
    rewrite ^/reference/policy$ /reference/ai-agents permanent;
    rewrite ^/reference/observability$ /reference/ai-agents permanent;
    rewrite ^/reference/wdk-gasless$ /reference/wdk permanent;
    rewrite ^/reference/wdk-bridge$ /reference/wdk permanent;
    rewrite ^/reference/wdk-multisig$ /reference/wdk permanent;
    rewrite ^/reference/react-native$ /reference/react permanent;
    rewrite ^/advanced/a2a-negotiation$ /advanced/a2a permanent;
    rewrite ^/advanced/deployment$ /guides/production-deployment permanent;
    rewrite ^/advanced/best-practices$ /advanced/operations permanent;
    rewrite ^/advanced/performance$ /advanced/operations permanent;
    rewrite ^/advanced/troubleshooting$ /advanced/operations permanent;
    rewrite ^/advanced/intent-payments$ /advanced/smart-router permanent;
    rewrite ^/advanced/streaming-payments$ /advanced/experimental permanent;
    rewrite ^/advanced/zk-payments$ /advanced/experimental permanent;
    rewrite ^/advanced/migration-v1-to-v2$ /advanced/migration permanent;
    rewrite ^/advanced/migration-v2\.2-to-v2\.3$ /advanced/migration permanent;

    location / {
        try_files $uri $uri.html $uri/ /404.html =404;
    }

    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com; connect-src 'self' https://www.google-analytics.com https://cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'" always;
    add_header X-Permitted-Cross-Domain-Policies "none" always;
}
EOF
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/ || exit 1
