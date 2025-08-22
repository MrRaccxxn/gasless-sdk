# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S relayer -u 1001

WORKDIR /app

# Copy dependencies and source code
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=relayer:nodejs . .

# Security: don't run as root
USER relayer

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

EXPOSE 3001

CMD ["node", "relayer-service.js"]