# Imagen base: Node.js 18 en Alpine Linux (versión ligera)
FROM node:18-alpine

# Establecer directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (optimización de caché)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo el código fuente
COPY . .

# Exponer puerto 5173 (Vite)
EXPOSE 5173

# Comando para ejecutar la aplicación
# --host permite acceso desde fuera del contenedor
CMD ["npm", "run", "dev", "--", "--host"]
