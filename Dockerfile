FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++ openssl
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Generate Prisma Client
RUN npx prisma generate
# Build the application
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET
RUN NEXT_TELEMETRY_DISABLED=1 SKIP_AUTH_MIDDLEWARE=1 NEXTAUTH_URL=$NEXTAUTH_URL npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat wget
ENV NODE_ENV=production
# Copy the standalone server and required assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy Prisma schema and migrations for runtime CLI commands
COPY --from=builder /app/prisma ./prisma
# Copy scripts and package.json for npm run db:seed and other scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
# Ensure node_modules is available for runtime tools like Prisma CLI when compose runs migrations
COPY --from=builder /app/node_modules ./node_modules
# Copy any runtime assets like uploads directory placeholder
RUN mkdir -p /app/uploads
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
