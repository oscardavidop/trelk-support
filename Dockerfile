# ─── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copy source & compile TypeScript
COPY tsconfig.json .
COPY src ./src
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ─── Stage 2: Production ───────────────────────────────────────────────────
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001 -G nodejs

WORKDIR /app

# Copy built artifacts and production node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Create writable directories
RUN mkdir -p uploads exports certs && chown -R appuser:nodejs uploads exports certs

USER appuser

EXPOSE 8443

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8443/health || exit 1

CMD ["node", "dist/server.js"]
