# ══════════════════════════════════════════════════════════════════════════════
#  GramGyan Backend — Optimised Multi-Stage Dockerfile
#  Base: node:20-alpine  (minimal attack surface)
# ══════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
#  STAGE 1: builder
#  Installs ALL dependencies, compiles TypeScript → dist/
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Security: run as non-root during build
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Cache dependency layer before copying source
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for runtime stage
RUN npm prune --production

# ────────────────────────────────────────────────────────────────────────────
#  STAGE 2: runtime
#  Minimal production image — only dist/ + production node_modules
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security hardening
RUN apk add --no-cache dumb-init && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only what the runtime needs
COPY --from=builder --chown=appuser:appgroup /app/dist          ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules  ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json  ./package.json

# Environment injection matrix
ENV NODE_ENV=production \
    PORT=3001 \
    LOG_LEVEL=info \
    LOG_FORMAT=json

# Expose application port
EXPOSE 3001

# Switch to non-root user
USER appuser

# dumb-init: proper PID 1 signal forwarding
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# ── Docker health check (Cloud Run will also probe /api/health) ────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })"
