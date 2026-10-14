# Multi-stage Dockerfile for Rota Express API
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript dist and migrations
COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations

EXPOSE 5001

CMD ["node", "dist/index.js"]
