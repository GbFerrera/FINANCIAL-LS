#!/usr/bin/env bash
# Backup rápido antes de deploy (PG + uploads). Instalar em /opt/projects-linksystem/.
set -euo pipefail

MODE="${1:-quick}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/projects-linksystem}"
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="$BACKUP_ROOT/$STAMP"
mkdir -p "$DIR"

docker exec projects-linksystem-db-1 pg_dump -U postgres -Fc financial_ls > "$DIR/financial_ls.dump"
docker exec projects-linksystem-db-1 pg_dump -U postgres -Fc evolution > "$DIR/evolution.dump" 2>/dev/null || true
tar -czf "$DIR/uploads.tgz" -C /opt/projects-linksystem uploads

if [[ "$MODE" == "full" ]]; then
  docker volume inspect bsogksw4wkc4g88ssgcwwggs_postgres-data bsogksw4wkc4g88ssgcwwggs_evolution-instances > "$DIR/volumes.json"
fi

echo "[backup] ok $DIR ($(du -sh "$DIR" | cut -f1))"
