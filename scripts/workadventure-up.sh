#!/usr/bin/env bash
set -euo pipefail

WA_DIR="${WA_DIR:-$HOME/Desktop/workadventure}"
HOSTS_LINE='127.0.0.1 play.workadventure.localhost traefik.workadventure.localhost maps.workadventure.localhost api.workadventure.localhost front.workadventure.localhost redis.workadventure.localhost map-storage.workadventure.localhost uploader.workadventure.localhost icon.workadventure.localhost'

if [[ ! -d "$WA_DIR" ]]; then
  echo "Clone WorkAdventure em $WA_DIR primeiro."
  exit 1
fi

if ! grep -q 'play.workadventure.localhost' /etc/hosts 2>/dev/null; then
  echo "Adicionando /etc/hosts (sudo)..."
  echo "$HOSTS_LINE" | sudo tee -a /etc/hosts >/dev/null
fi

cd "$WA_DIR"
if [[ ! -f .env ]]; then
  cp .env.template .env
fi

echo "Subindo WorkAdventure (primeira vez pode levar 5–15 min por npm install)..."
docker compose \
  -f docker-compose.yaml \
  -f docker-compose-no-oidc.yaml \
  -f docker-compose.linksystem.yaml \
  up -d

echo ""
echo "Acompanhe: docker compose -f docker-compose.yaml logs -f play"
echo "Abra: http://play.workadventure.localhost/"
echo "PM:   http://localhost:3003/team/office"
