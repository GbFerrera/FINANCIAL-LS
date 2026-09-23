-- Usuário da aplicação (não depender da role postgres, que pode ficar NOLOGIN em incidentes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'financial_app') THEN
    CREATE ROLE financial_app WITH LOGIN SUPERUSER PASSWORD 'postgres';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE financial_ls TO financial_app;
