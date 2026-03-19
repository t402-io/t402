FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY src/ src/
EXPOSE 3402
CMD ["node", "src/server.js"]
