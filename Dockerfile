# syntax=docker/dockerfile:1

# ─── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the bundle here, at BUILD time, not read at
# run time. Anything documented as a per-deployment value has to arrive as a
# build argument or it silently keeps its default in the image, which is the way
# this product actually runs.
#
# The Reverb host is deliberately not among them: it is resolved in the browser
# from the page's own origin, so the image survives the LAN address changing.
ARG NEXT_PUBLIC_REVERB_APP_KEY=trident-local
ENV NEXT_PUBLIC_REVERB_APP_KEY=${NEXT_PUBLIC_REVERB_APP_KEY}

# How often the television reconciles no matter what its socket claims. Empty
# keeps the documented default, which is what the code falls back to.
ARG NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS=
ENV NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS=${NEXT_PUBLIC_TRIDENT_RECONCILE_POLL_MS}

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# `output: "standalone"` ships only the server and the modules it actually uses.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Never root.
USER node

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
