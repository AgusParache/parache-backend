# Usamos Node 22 en versión slim
FROM node:22-slim

# Instalamos las utilidades de extracción que pide Puppeteer (unzip) 
# y las dependencias necesarias para que corra el navegador
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Le indicamos a Puppeteer que use el Chromium que acabamos de instalar en el sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos las configuraciones de node
COPY package.json ./

# Instalamos las dependencias de forma limpia
RUN npm install

# Copiamos el resto del backend
COPY . .

# Exponemos el puerto de Express
EXPOSE 3000

# Arrancamos la aplicación
CMD ["node", "server.js"]