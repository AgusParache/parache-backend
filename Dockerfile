# Usamos una imagen de Node que ya viene con Puppeteer y Chrome instalados
FROM ghcr.io/puppeteer/puppeteer:21.11.0

# Cambiamos al usuario root para evitar problemas de permisos
USER root

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos solamente el package.json (así ignoramos el lock roto)
COPY package.json ./

# Instalamos las dependencias limpias omitiendo el candado viejo
RUN npm install --no-package-lock

# Copiamos el resto de los archivos del backend
COPY . .

# Exponemos el puerto que usa tu servidor Express
EXPOSE 3000

# Comando para arrancar tu aplicación
CMD ["node", "server.js"]