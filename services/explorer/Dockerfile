FROM node:22-alpine AS builder
WORKDIR /app

# Install build tools for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---

FROM node:22-alpine
WORKDIR /app

# Runtime deps for better-sqlite3
RUN apk add --no-cache libstdc++

COPY --from=builder /app/node_modules node_modules/
COPY package.json ./
COPY src/ src/
COPY public/ public/

USER node
EXPOSE 3404

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost:3404/health || exit 1

CMD ["node", "src/server.js"]
