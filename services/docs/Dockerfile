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
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'" always;
    add_header X-Permitted-Cross-Domain-Policies "none" always;
}
EOF
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/ || exit 1
