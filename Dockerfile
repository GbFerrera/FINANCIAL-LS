FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++ openssl

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
# Ensure NEXTAUTH_URL is set during build to avoid Invalid URL errors in prerender
ARG NEXTAUTH_URL=http://localhost:3000
RUN NEXT_TELEMETRY_DISABLED=1 SKIP_AUTH_MIDDLEWARE=1 NEXTAUTH_URL=$NEXTAUTH_URL npm run build

# Expose the port
EXPOSE 3000

# Start the application (standalone output)
CMD ["node", ".next/standalone/server.js"]
