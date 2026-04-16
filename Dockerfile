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

# Build-time args (not secrets, just placeholders for Next.js compilation)
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG NEXTAUTH_URL="http://localhost:3000"

RUN NEXTAUTH_SECRET=build-placeholder \
    DATABASE_URL=${DATABASE_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    npx prisma generate && \
    NEXTAUTH_SECRET=build-placeholder \
    DATABASE_URL=${DATABASE_URL} \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
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

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
