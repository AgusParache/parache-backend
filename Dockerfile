# Usamos la imagen oficial y limpia de Node
FROM node:18-slim

# Instalamos las herramientas necesarias para que corra Puppeteer sin problemas en Railway
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de configuración
COPY package.json ./

# Instalamos las dependencias limpias de npm
RUN npm install

# Copiamos el resto de tu código
COPY . .

# Exponemos el puerto de tu servidor
EXPOSE 3000

# Iniciamos la aplicación
CMD ["node", "server.js"]