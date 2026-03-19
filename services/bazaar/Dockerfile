FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
COPY src/ src/
COPY openapi.yaml .
RUN mkdir -p /app/data && chown -R app:app /app
USER app
EXPOSE 3402
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://localhost:3402/health || exit 1
CMD ["node", "src/server.js"]
