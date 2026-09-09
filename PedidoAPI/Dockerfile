# ---------- etapa 1: compila o TypeScript ----------
FROM node:24-alpine AS builder
WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- etapa 2: imagem final, so com o necessario para rodar ----------
FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /build/dist ./dist

# A hospedagem informa a porta pela variavel PORT; 3000 e o padrao local.
ENV PORT=3000
ENV DATABASE_FILE=/tmp/pedidos.db
EXPOSE 3000

CMD ["node", "dist/server.js"]
