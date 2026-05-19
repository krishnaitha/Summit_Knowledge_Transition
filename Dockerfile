# ---- builder: full install + compile ----
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
# BuildKit cache mount keeps npm's download cache between builds (not stored in image)
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
# Ensure public/ exists (Next.js standalone copies it to runner)
RUN mkdir -p public && npm run build

# ---- runner: minimal production image ----
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME="0.0.0.0" \
    PORT=3000

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# standalone output bundles server.js + traced node_modules — no full node_modules needed
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/worker          ./worker

# Ensure uploads dir exists and is writable by the nextjs user
# (named Docker volumes copy ownership from the image on first init)
RUN mkdir -p /app/public/uploads && chown nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]

# ---- worker: same runner filesystem, different entrypoint ----
FROM runner AS worker

CMD ["node", "worker/index.mjs"]

# ---- migrate: lightweight database migration runner ----
FROM node:22-slim AS migrate
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm pkg delete scripts.prepare
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --omit=dev

COPY postgres/migrations ./postgres/migrations

CMD ["node_modules/.bin/node-pg-migrate", "up", "-m", "postgres/migrations"]
