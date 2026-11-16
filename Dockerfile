# syntax=docker/dockerfile:1
# Kaligula web + API (Next.js standalone on Node 22).
# Moving to Bun later only requires changing the base images and the start command.

FROM node:22-alpine AS deps
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY packages/api/package.json packages/api/
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w @kaligula/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S kaligula && adduser -S kaligula -G kaligula
COPY --from=build --chown=kaligula:kaligula /app/apps/web/.next/standalone ./
COPY --from=build --chown=kaligula:kaligula /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=kaligula:kaligula /app/apps/web/public ./apps/web/public
USER kaligula
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
