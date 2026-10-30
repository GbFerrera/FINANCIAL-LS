#!/usr/bin/env bash
# Redeploy do app Projects (Coolify) usando imagem pré-buildada no GHCR.
# Instalar na VPS: cp scripts/vps-redeploy-from-ghcr.sh /root/deploy-projects-from-ghcr.sh && chmod +x /root/deploy-projects-from-ghcr.sh
set -euo pipefail

IMAGE="${1:?Informe a imagem completa, ex.: ghcr.io/gbferrera/financial-ls:abc1234}"
APP_DIR="${APP_DIR:-/data/coolify/applications/bsogksw4wkc4g88ssgcwwggs}"
SRC_COMPOSE="$APP_DIR/docker-compose.yaml"
RUN_COMPOSE="$APP_DIR/docker-compose.ghcr-run.yaml"

if [[ ! -f "$SRC_COMPOSE" ]]; then
  echo "Compose Coolify não encontrado: $SRC_COMPOSE"
  exit 1
fi

echo "[deploy] pull $IMAGE"
docker pull "$IMAGE"

python3 - "$SRC_COMPOSE" "$RUN_COMPOSE" "$IMAGE" <<'PY'
import sys
import yaml

src, dst, image = sys.argv[1:4]
with open(src, encoding="utf-8") as f:
    data = yaml.safe_load(f)

app = data["services"]["app"]
app.pop("build", None)
app["image"] = image
app["pull_policy"] = "always"

with open(dst, "w", encoding="utf-8") as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)

print(f"[deploy] compose gerado: {dst}")
PY

cd "$APP_DIR"
docker compose -f "$RUN_COMPOSE" up -d --no-build --remove-orphans app

echo "[deploy] ok — container:"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -E 'app-bsog|NAMES' || true
