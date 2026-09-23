#!/usr/bin/env bash
# Move tasks Esteira A → workspace CEO via Prisma (sem deploy).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi
if [[ -f .env ]]; then set -a; source .env; set +a; fi
exec npx tsx scripts/move-tasks-to-ceo-workspace-prisma.ts
