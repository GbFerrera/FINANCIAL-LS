#!/usr/bin/env bash
# Redeploy do app Projects (Coolify) usando imagem pré-buildada no GHCR.
# Instalar na VPS: cp scripts/vps-redeploy-from-ghcr.sh /root/deploy-projects-from-ghcr.sh && chmod +x /root/deploy-projects-from-ghcr.sh
set -euo pipefail

IMAGE="${1:?Informe a imagem completa, ex.: ghcr.io/gbferrera/financial-ls:abc1234}"
APP_DIR="${APP_DIR:-/data/coolify/applications/bsogksw4wkc4g88ssgcwwggs}"
SRC_COMPOSE="$APP_DIR/docker-compose.yaml"
RUN_COMPOSE="$APP_DIR/docker-compose.ghcr-run.yaml"
PATCH_SCRIPT="${PATCH_SCRIPT:-/root/scripts/coolify-compose-app-service.py}"

if [[ ! -f "$SRC_COMPOSE" ]]; then
  echo "Compose Coolify não encontrado: $SRC_COMPOSE"
  exit 1
fi

echo "[deploy] pull $IMAGE"
docker pull "$IMAGE"

if [[ ! -f "$PATCH_SCRIPT" ]]; then
  # fallback inline (compatível com compose antigo e Coolify sem serviço "app")
  APP_SERVICE="$(
    python3 - "$SRC_COMPOSE" "$RUN_COMPOSE" "$IMAGE" <<'PY'
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
app = services[key]
app.pop("build", None)
app["image"] = image
app["pull_policy"] = "always"
with open(dst, "w", encoding="utf-8") as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)
print(key)
PY
  )"
else
  APP_SERVICE="$(python3 "$PATCH_SCRIPT" "$SRC_COMPOSE" "$RUN_COMPOSE" "$IMAGE")"
fi

echo "[deploy] serviço alvo: $APP_SERVICE"

cd "$APP_DIR"
docker compose -f "$RUN_COMPOSE" up -d --no-build --remove-orphans "$APP_SERVICE"

echo "[deploy] ok — container:"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'bsogksw|NAMES' || true

echo "[deploy] aguardando app (15s)..."
sleep 15
APP_CTN="$(docker ps -a --format '{{.Names}}' | grep '^bsogksw4wkc4g88ssgcwwggs-' | grep -v postgres | grep -v db- | head -1 || true)"
if [[ -n "${APP_CTN:-}" ]]; then
  echo "[deploy] logs ($APP_CTN, tail 60):"
  docker logs "$APP_CTN" --tail 60 2>&1 || true
  RUNNING="$(docker inspect -f '{{.State.Running}}' "$APP_CTN" 2>/dev/null || echo false)"
  if [[ "$RUNNING" != "true" ]]; then
    echo "[deploy] ERRO: container da app não está running"
    exit 1
  fi
else
  echo "[deploy] aviso: container da app não identificado para logs"
fi
