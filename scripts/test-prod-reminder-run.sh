#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_URL:-https://projects.linksystem.tech}"
EMAIL="${TEST_EMAIL:-business.gabrielferreira@gmail.com}"
PASS="${TEST_PROD_PASSWORD:?Defina TEST_PROD_PASSWORD}"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

CSRF="$(curl -sS -c "$COOKIE_JAR" "$BASE/api/auth/csrf" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")"

curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASS" \
  --data-urlencode "redirect=false" \
  --data-urlencode "json=true" > /dev/null

SESSION="$(curl -sS -b "$COOKIE_JAR" "$BASE/api/auth/session")"
echo "session=$SESSION"

BODY='{"onlyClientEmail":"'"$EMAIL"'"}'
echo "POST run → $EMAIL"
curl -sS -b "$COOKIE_JAR" -X POST "$BASE/api/financial/subscription-reminders/run" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool
