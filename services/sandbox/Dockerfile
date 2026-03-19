FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY src/ src/
EXPOSE 3406
CMD ["node", "src/proxy.js"]
