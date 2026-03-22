FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY src/ src/
COPY public/ public/
USER node
EXPOSE 3405
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q --spider http://localhost:3405/health || exit 1
CMD ["node", "src/server.js"]
