#!/bin/sh
# Roda após o Postgres subir: garante login da role postgres (init legado) e do financial_app.
set -e
until pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-financial_ls}" >/dev/null 2>&1; do
  sleep 1
done

psql -v ON_ERROR_STOP=0 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-financial_ls}" <<-EOSQL
  ALTER ROLE postgres WITH LOGIN;
  ALTER ROLE postgres WITH PASSWORD '${POSTGRES_PASSWORD:-postgres}';
  DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'financial_app') THEN
      CREATE ROLE financial_app WITH LOGIN SUPERUSER PASSWORD '${POSTGRES_PASSWORD:-postgres}';
    ELSE
      ALTER ROLE financial_app WITH LOGIN SUPERUSER PASSWORD '${POSTGRES_PASSWORD:-postgres}';
    END IF;
  END \$\$;
EOSQL
