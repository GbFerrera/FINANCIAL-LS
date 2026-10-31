#!/usr/bin/env bash
# Deploy Projects (PM) em /opt/projects-linksystem — sem Coolify.
# Nunca remove volumes nomeados (postgres / evolution / uploads).
set -euo pipefail

IMAGE="${1:?Informe a imagem, ex.: ghcr.io/gbferrera/financial-ls:latest}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/projects-linksystem}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.prod.yml}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-$DEPLOY_DIR/backup-before-deploy.sh}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose não encontrado: $COMPOSE_FILE"
  exit 1
fi

for vol in bsogksw4wkc4g88ssgcwwggs_postgres-data bsogksw4wkc4g88ssgcwwggs_evolution-instances; do
  if ! docker volume inspect "$vol" >/dev/null 2>&1; then
    echo "[deploy] ERRO: volume obrigatório ausente: $vol"
    exit 1
  fi
done

if [[ -x "$BACKUP_SCRIPT" ]]; then
  echo "[deploy] backup pré-deploy..."
  "$BACKUP_SCRIPT" quick
fi

echo "[deploy] pull $IMAGE"
docker pull "$IMAGE"

export APP_IMAGE="$IMAGE"
cd "$DEPLOY_DIR"

# Sem `down -v` / `volume rm` — apenas recria containers apontando aos mesmos volumes.
docker compose --env-file "$DEPLOY_DIR/.env" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "[deploy] containers:"
docker compose --env-file "$DEPLOY_DIR/.env" -f "$COMPOSE_FILE" ps

APP_CTN="$(docker compose --env-file "$DEPLOY_DIR/.env" -f "$COMPOSE_FILE" ps -q app || true)"
if [[ -n "$APP_CTN" ]]; then
  echo "[deploy] logs app (tail 15):"
  docker logs --tail 15 "$(docker inspect --format '{{.Name}}' "$APP_CTN" | sed 's/^\///')" 2>&1 || true
fi

echo "[deploy] ok"
