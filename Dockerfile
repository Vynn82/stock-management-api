# ==========================================
# Multi-stage Production Dockerfile
# ==========================================

# 1. Base image with C++ build tools for native modules (bcrypt)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

# 2. Dependencies stage
FROM base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 3. Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY assets ./assets
RUN npm run build
RUN npm prune --omit=dev

# 4. Lean Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl

# USER node
RUN mkdir -p /app/logs && chown -R node:node /app
USER node

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/assets ./assets

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/products/import/template || exit 1

CMD ["node", "dist/main.js"]
