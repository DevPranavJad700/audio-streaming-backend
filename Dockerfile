# ─── Multi-Stage Production Dockerfile ──────────────────────────────────────────

# Stage 1: Dependency resolution
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Minimal runtime image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create app directory with proper ownership
RUN chown -R node:node /app

# Copy production dependencies and application sources
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./
COPY --chown=node:node src/ ./src/

# Run as non-privileged node user for maximum security
USER node

EXPOSE 3000

# Container healthcheck querying /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
