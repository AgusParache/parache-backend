# Usamos Node 22 en su versión slim como recomendó Railway
FROM node:22-slim

# Instalamos git (para resolver el error de clonado) y dependencias para Chromium
RUN apt-get update && apt-get install -y \
    git \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos solo el package.json limpio
COPY package.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del backend
COPY . .

# Exponemos el puerto
EXPOSE 3000

# Arrancamos el servidor
CMD ["node", "server.js"]