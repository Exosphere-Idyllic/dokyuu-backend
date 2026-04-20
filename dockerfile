# ═══════════════════════════════════════════════
#  STAGE 1 — Build
# ═══════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias primero (capa cacheada si package.json no cambia)
COPY package*.json ./
RUN npm ci

# Copiar fuentes y compilar
COPY . .
RUN npm run build

# ═══════════════════════════════════════════════
#  STAGE 2 — Production
# ═══════════════════════════════════════════════
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el build del stage anterior
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
