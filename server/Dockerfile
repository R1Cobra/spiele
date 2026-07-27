# KMF Spiele – Spielstand-Server
# Bewusst ohne npm-Pakete: nur eine Datei, nichts zu installieren, nichts zu bauen.
FROM node:22-alpine
WORKDIR /app

COPY server.js ./

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000

EXPOSE 3000

RUN mkdir -p /data && chown node:node /data
USER node

CMD ["node", "server.js"]
