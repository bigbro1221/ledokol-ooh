FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG NEXTAUTH_URL="http://localhost:3000"
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""

RUN NEXTAUTH_SECRET=build-placeholder \
    DATABASE_URL=${DATABASE_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN} \
    npx prisma generate && \
    NEXTAUTH_SECRET=build-placeholder \
    DATABASE_URL=${DATABASE_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN} \
    npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Keep Prisma CLI available for migrations (db push / migrate deploy)
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=deps /app/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version

# Install Postmark with its full transitive tree — Next.js standalone tracer
# doesn't follow postmark's CJS requires reliably, so let npm resolve them.
RUN npm install --no-save --no-package-lock --omit=dev postmark@4.0.7

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
