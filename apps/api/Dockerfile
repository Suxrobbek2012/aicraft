FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ai-core/package.json ./packages/ai-core/
RUN npm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npm run build --workspace=@go-ai/shared
RUN npm run build --workspace=@go-ai/ai-core
RUN npm run build --workspace=@go-ai/database
RUN npm run build --workspace=@go-ai/api

# Production image
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/packages/database/generated ./packages/database/generated
COPY --from=builder --chown=apiuser:nodejs /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules

RUN mkdir -p uploads && chown apiuser:nodejs uploads

USER apiuser
EXPOSE 4000

CMD ["node", "dist/server.js"]
