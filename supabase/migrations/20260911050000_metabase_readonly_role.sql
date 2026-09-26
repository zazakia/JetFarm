-- Migration: 20260911050000_metabase_readonly_role.sql
-- Description: Create dedicated read-only role for Metabase BI reporting
--   - Grants SELECT on public schema tables & views
--   - Sets default privileges so future tables are readable

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'metabase_reader') THEN
        CREATE ROLE metabase_reader WITH LOGIN PASSWORD 'CHANGE_THIS_METABASE_PASSWORD_BEFORE_RUNNING';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO metabase_reader;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO metabase_reader;
