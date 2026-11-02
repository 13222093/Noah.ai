# syntax=docker/dockerfile:1.7
# Noah AI web (Next.js standalone). Reproducible (npm ci + lockfile), non-root,
# no env files, data or models baked in (B-030, G-104).
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so each
# stack (noah-prod, noah-staging) builds its own image with its own build args.
# Server secrets (SUPABASE_SERVICE_ROLE_KEY, SENTRY_DSN, ...) are runtime env only.

ARG NODE_IMAGE=node:22-alpine

# ---- deps -------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build ------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_STANDALONE=1 switches next.config.js to output: 'standalone'.
RUN NEXT_STANDALONE=1 npm run build

# ---- runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 10001 noah && adduser -S -u 10001 -G noah -h /app noah

COPY --from=builder --chown=noah:noah /app/.next/standalone ./
COPY --from=builder --chown=noah:noah /app/.next/static ./.next/static
COPY --from=builder --chown=noah:noah /app/public ./public

USER noah
EXPOSE 3000

# Liveness only: the Next.js server answers HTTP. /robots.txt is static and
# allowlisted by middleware.ts, so it needs no credential and no upstream; any
# status below 500 means the process is serving. /api/v1/health is the data
# freshness report (503 while a connector is stale or the DB is unconfigured)
# for the uptime monitor; it must not mark this container unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/robots.txt',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
