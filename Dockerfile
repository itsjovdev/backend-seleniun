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
    # 🔐 PDFTK para encriptación REAL
    pdftk-java \
    # Fuentes para mejor renderizado
    fonts-dejavu \
    fonts-liberation \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar instalaciones
RUN gs --version && echo "✅ Ghostscript instalado correctamente"
RUN pdftk --version && echo "✅ PDFTK instalado correctamente"