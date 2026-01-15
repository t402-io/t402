# syntax=docker/dockerfile:1

# =============================================================================
# t402.io Site - Optimized Standalone Dockerfile
# Build time: ~5-10 minutes (single architecture)
# =============================================================================

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:22-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy package files for caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code
COPY . .

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# =============================================================================
# Stage 3: Runner (Production)
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
