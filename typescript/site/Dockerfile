# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml ./

# Copy typescript workspace files
COPY typescript/package.json typescript/pnpm-lock.yaml typescript/pnpm-workspace.yaml ./typescript/

# Copy all package.json files for workspace packages
COPY typescript/site/package.json ./typescript/site/
COPY typescript/packages/core/package.json ./typescript/packages/core/
COPY typescript/packages/http/next/package.json ./typescript/packages/http/next/
COPY typescript/packages/http/paywall/package.json ./typescript/packages/http/paywall/
COPY typescript/packages/mechanisms/evm/package.json ./typescript/packages/mechanisms/evm/
COPY typescript/packages/mechanisms/svm/package.json ./typescript/packages/mechanisms/svm/

# Install root dependencies
RUN pnpm install --frozen-lockfile

# Install typescript workspace dependencies
WORKDIR /app/typescript
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy everything from deps
COPY --from=deps /app ./

# Copy source code
COPY typescript/ ./typescript/

# Build workspace packages first, then site
WORKDIR /app/typescript
RUN pnpm -r --filter=site... run build

# =============================================================================
# Stage 3: Runner
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/typescript/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/typescript/site/.next/static ./typescript/site/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/typescript/site/public ./typescript/site/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

WORKDIR /app/typescript/site
CMD ["node", "server.js"]
