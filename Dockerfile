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
    # 🔥 GHOSTSCRIPT para compresión PDF (esto faltaba!)
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

# Instalar dependencias de Node
COPY package*.json ./
RUN npm ci

# Copiar código y construir
COPY . .
RUN rm -rf dist && npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]