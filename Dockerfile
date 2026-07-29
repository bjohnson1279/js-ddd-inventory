# Stage 1: build
FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: production image
FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY --from=builder /app/dist ./dist
RUN npx prisma generate

EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --url \"$DATABASE_URL\" --accept-data-loss && node dist/index.js"]
