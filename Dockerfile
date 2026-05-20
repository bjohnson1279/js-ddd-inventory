# Stage 1: build
FROM node:20 AS builder
WORKDIR /app

# Install dependencies (including dev deps for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: production image
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy built output
COPY --from=builder /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
