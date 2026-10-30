#!/usr/bin/env bash
# Configura app Projects no Coolify: imagem GHCR, auto-deploy Git off, compose sem build local.
set -euo pipefail

COOLIFY_APP_UUID="${COOLIFY_APP_UUID:-bsogksw4wkc4g88ssgcwwggs}"
GHCR_IMAGE="${GHCR_IMAGE:-ghcr.io/gbferrera/financial-ls:latest}"
GHCR_USER="${GHCR_USER:-GbFerrera}"
GHCR_TOKEN="${GHCR_TOKEN:?GHCR_TOKEN obrigatório}"

APP_DIR="/data/coolify/applications/${COOLIFY_APP_UUID}"
COMPOSE="${APP_DIR}/docker-compose.yaml"
DB="coolify-db"

echo "[coolify-ghcr] login GHCR (Docker na VPS)"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

psql() {
  docker exec "$DB" psql -U coolify -d coolify "$@"
}

psql_try() {
  psql "$@" || echo "[coolify-ghcr] aviso: comando opcional falhou (continuando)"
}

echo "[coolify-ghcr] application uuid=${COOLIFY_APP_UUID}"
APP_ID="$(psql -tA -c "SELECT id FROM applications WHERE uuid = '${COOLIFY_APP_UUID}' LIMIT 1;")"
if [[ -z "$APP_ID" ]]; then
  echo "Application não encontrada no Coolify DB."
  exit 1
fi
echo "[coolify-ghcr] application id=${APP_ID}"

echo "[coolify-ghcr] DB: auto-deploy off + imagem GHCR"
psql -v ON_ERROR_STOP=1 -c "UPDATE application_settings SET is_auto_deploy_enabled = false WHERE application_id = ${APP_ID};"
psql_try -c "UPDATE application_settings SET is_preview_deployments_enabled = false WHERE application_id = ${APP_ID};"
psql_try -c "UPDATE applications SET build_pack = 'dockerimage' WHERE id = ${APP_ID};"
psql_try -c "UPDATE applications SET docker_registry_image_name = 'ghcr.io/gbferrera/financial-ls' WHERE id = ${APP_ID};"
psql_try -c "UPDATE applications SET docker_registry_image_tag = 'latest' WHERE id = ${APP_ID};"

if [[ ! -f "$COMPOSE" ]]; then
  echo "Compose não encontrado: $COMPOSE"
  exit 1
fi

cp -a "$COMPOSE" "${COMPOSE}.bak.$(date +%Y%m%d%H%M%S)"

echo "[coolify-ghcr] compose → image only (sem build)"
python3 - "$COMPOSE" "$GHCR_IMAGE" <<'PY'
import sys
import yaml

path, image = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = yaml.safe_load(f)

app = data["services"]["app"]
app.pop("build", None)
app["image"] = image
app["pull_policy"] = "always"

with open(path, "w", encoding="utf-8") as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False)
PY

echo "[coolify-ghcr] estado atual:"
psql -c "SELECT a.id, a.name, a.build_pack, a.docker_registry_image_name, a.docker_registry_image_tag, s.is_auto_deploy_enabled FROM applications a JOIN application_settings s ON s.application_id = a.id WHERE a.uuid = '${COOLIFY_APP_UUID}';"

grep -E '^    image:|^    build:' "$COMPOSE" || true

echo "[coolify-ghcr] ok — deploy de app só via GitHub Actions (projects-deploy.yml)"
