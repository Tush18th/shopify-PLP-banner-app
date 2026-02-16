# ==============================================================================
# Stage 1: Builder — install ALL deps (including devDependencies) and build
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install ALL dependencies (including vite in devDependencies)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy full source
COPY . .

# Build the Remix app (requires vite from devDependencies)
RUN npm run build

# ==============================================================================
# Stage 2: Production — only production deps + built output
# ==============================================================================
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -D appuser

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Generate Prisma client in production stage
RUN npx prisma generate

# Copy built output from builder stage
COPY --from=builder /app/build ./build

# Copy public assets if present
COPY --from=builder /app/public ./public

# Copy Shopify config for reference
COPY shopify.app.toml ./

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the app port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
