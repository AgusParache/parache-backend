FROM ghcr.io/puppeteer/puppeteer:21.11.0

USER root

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["node", "server.js"]
