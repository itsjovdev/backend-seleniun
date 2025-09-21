FROM node:20-bullseye

WORKDIR /app

# 🎯 CRÍTICO: Instalar Ghostscript para compresión PDF
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    # LibreOffice para conversión Word/PDF
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    # 🔥 GHOSTSCRIPT para compresión PDF
    ghostscript \
    # Herramientas adicionales de PDF
    poppler-utils \
    qpdf \
    # Fuentes para mejor renderizado
    fonts-dejavu \
    fonts-liberation \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar instalación de Ghostscript
RUN gs --version && echo "✅ Ghostscript instalado correctamente"

# 🔧 Instalar dependencias de Node (OPTIMIZADO)
COPY package*.json ./

# Limpiar cache y usar npm ci para builds más estables
RUN npm cache clean --force && \
    npm ci --only=production --no-audit --no-fund --verbose

# Instalar dependencias de desarrollo para el build
RUN npm ci --no-audit --no-fund --verbose

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Limpiar dependencias de desarrollo para reducir tamaño
RUN npm prune --production

EXPOSE 3000

# Usar el comando correcto
CMD ["node", "dist/main.js"]