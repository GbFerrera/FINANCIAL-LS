#!/usr/bin/env bash
# Redeploy do app Projects (Coolify) usando imagem pré-buildada no GHCR.
# Instalar na VPS: cp scripts/vps-redeploy-from-ghcr.sh /root/deploy-projects-from-ghcr.sh && chmod +x /root/deploy-projects-from-ghcr.sh
set -euo pipefail

IMAGE="${1:?Informe a imagem completa, ex.: ghcr.io/gbferrera/financial-ls:abc1234}"
APP_DIR="${APP_DIR:-/data/coolify/applications/bsogksw4wkc4g88ssgcwwggs}"
SRC_COMPOSE="$APP_DIR/docker-compose.yaml"
OVERRIDE_COMPOSE="$APP_DIR/docker-compose.ghcr-override.yaml"
PATCH_SCRIPT="${PATCH_SCRIPT:-/root/scripts/coolify-compose-app-service.py}"

if [[ ! -f "$SRC_COMPOSE" ]]; then
  echo "Compose Coolify não encontrado: $SRC_COMPOSE"
  exit 1
fi

echo "[deploy] pull $IMAGE"
docker pull "$IMAGE"

if [[ ! -f "$PATCH_SCRIPT" ]]; then
  APP_SERVICE="$(
    python3 - "$SRC_COMPOSE" "$OVERRIDE_COMPOSE" "$IMAGE" <<'PY'
import sys
import yaml

src, dst, image = sys.argv[1:4]
with open(src, encoding="utf-8") as f:
    data = yaml.safe_load(f)
services = data.get("services") or {}
if "app" in services:
    key = "app"
else:
    skip = ("db", "postgres", "redis", "mysql", "mariadb", "mongo")
    key = None
    for name in services:
        if any(s in name.lower() for s in skip):
            continue
        key = name
        break
    if key is None:
        key = next(iter(services))
override = {"services": {key: {"image": image, "pull_policy": "always"}}}
with open(dst, "w", encoding="utf-8") as f:
    yaml.dump(override, f, default_flow_style=False, sort_keys=False)
print(key)
PY
  )"
else
  APP_SERVICE="$(python3 "$PATCH_SCRIPT" "$SRC_COMPOSE" "$OVERRIDE_COMPOSE" "$IMAGE" "$APP_DIR")"
fi

echo "[deploy] serviço alvo: $APP_SERVICE"
if [[ -f "$APP_DIR/.env" ]]; then
  echo "[deploy] Coolify .env presente ($(grep -cve '^\s*$' -e '^\s*#' "$APP_DIR/.env" || echo 0) linhas úteis)"
else
  echo "[deploy] aviso: $APP_DIR/.env não encontrado — env pode vir só do compose"
  ls -la "$APP_DIR" 2>/dev/null | head -20 || true
fi

cd "$APP_DIR"
COMPOSE_CMD=(docker compose)
if [[ -f "$APP_DIR/.env" ]]; then
  COMPOSE_CMD+=(--env-file "$APP_DIR/.env")
fi
COMPOSE_CMD+=(-f "$SRC_COMPOSE" -f "$OVERRIDE_COMPOSE")

"${COMPOSE_CMD[@]}" up -d --no-build --remove-orphans "$APP_SERVICE"

echo "[deploy] ok — container:"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'bsogksw|NAMES' || true

echo "[deploy] aguardando app (20s)..."
sleep 20
APP_CTN="$(docker ps -a --format '{{.Names}}' | grep '^bsogksw4wkc4g88ssgcwwggs-' | grep -viE 'postgres|redis' | head -1 || true)"
if [[ -n "${APP_CTN:-}" ]]; then
  echo "[deploy] logs ($APP_CTN, tail 80):"
  LOGS="$(docker logs "$APP_CTN" --tail 80 2>&1 || true)"
  echo "$LOGS"
  if echo "$LOGS" | grep -q 'Environment variable not found: DATABASE_URL'; then
    echo "[deploy] ERRO: DATABASE_URL ausente no container (compose/env Coolify)"
    exit 1
  fi
  RUNNING="$(docker inspect -f '{{.State.Running}}' "$APP_CTN" 2>/dev/null || echo false)"
  if [[ "$RUNNING" != "true" ]]; then
    echo "[deploy] ERRO: container da app não está running"
    exit 1
  fi
  if ! docker exec "$APP_CTN" sh -c 'test -n "${DATABASE_URL:-}"'; then
    echo "[deploy] ERRO: DATABASE_URL vazio dentro do container"
    exit 1
  fi
else
  echo "[deploy] aviso: container da app não identificado para logs"
fi
