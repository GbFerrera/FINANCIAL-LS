#!/usr/bin/env bash
# Corrige permissões de binários npm em volume macOS + reinicia serviços WA
set -euo pipefail
WA_DIR="${WA_DIR:-$HOME/Desktop/workadventure}"
cd "$WA_DIR"

echo "→ Corrigindo permissões node_modules/.bin ..."
docker compose -f docker-compose.yaml -f docker-compose-no-oidc.yaml -f docker-compose.linksystem.yaml \
  run --rm --user root play bash -lc '
    find /usr/src/app -path "*/node_modules/.bin/*" -type f -exec chmod +x {} + 2>/dev/null || true
    chown -R docker:docker /usr/src/app/play/node_modules /usr/src/app/node_modules 2>/dev/null || true
  ' 2>/dev/null || docker compose run --rm --user root play bash -lc '
    find /usr/src/app -path "*/node_modules/.bin/*" -type f -exec chmod +x {} + 2>/dev/null || true
  '

echo "→ Reiniciando play e map-storage ..."
docker compose -f docker-compose.yaml -f docker-compose-no-oidc.yaml -f docker-compose.linksystem.yaml \
  up -d play map-storage

echo "→ Acompanhe: docker logs -f workadventure-play-1"
echo "→ Teste: curl -H 'Host: play.workadventure.localhost' http://127.0.0.1/"
