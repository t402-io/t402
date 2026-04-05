FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/

USER node
EXPOSE 3406

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3406/health').then(r=>{if(!r.ok)throw r.status;process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "src/proxy.js"]
