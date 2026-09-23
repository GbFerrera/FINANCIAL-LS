#!/bin/sh
set -e
cd /app
echo "[start-prod] prisma migrate deploy..."
npx prisma migrate deploy
echo "[start-prod] starting Next.js..."
exec node server.js
