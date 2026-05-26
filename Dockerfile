FROM ghcr.io/puppeteer/puppeteer:22.2.3

USER root

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["node", "server.js"]