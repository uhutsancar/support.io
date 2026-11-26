#!/usr/bin/env bash
# Prepares the application database as the administrator: roles, grants and
# the extensions the migrations use but a non-superuser may not create.
#
# The image runs it once, when the data volume is first initialised. It is
# idempotent, so the same file brings an existing volume (or a database just
# restored from a dump) to the same state without touching its data:
#
#   docker compose -f docker-compose.prod.yml exec postgres \
#     /docker-entrypoint-initdb.d/010-supportio-roles.sh [database]
#
# Roles: DB_MIGRATION_USER owns the schema and runs migrations;
# DB_RUNTIME_USER only reads and writes rows; DB_BACKUP_USER (optional) only
# reads, for pg_dump. Passwords of roles that already exist are left alone.
set -euo pipefail

TARGET_DB="${1:-$POSTGRES_DB}"

for name in DB_MIGRATION_USER DB_RUNTIME_USER; do
  value="${!name:-}"
  if [[ ! "$value" =~ ^[a-z_][a-z0-9_]{0,62}$ ]]; then
    echo "$name must be a simple PostgreSQL role name" >&2
    exit 1
  fi
done
: "${DB_MIGRATION_PASSWORD:?DB_MIGRATION_PASSWORD is required}"
: "${DB_RUNTIME_PASSWORD:?DB_RUNTIME_PASSWORD is required}"
BACKUP_USER="${DB_BACKUP_USER:-}"
if [[ -n "$BACKUP_USER" ]]; then
  [[ "$BACKUP_USER" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || {
    echo "DB_BACKUP_USER must be a simple PostgreSQL role name" >&2
    exit 1
  }
  : "${DB_BACKUP_PASSWORD:?DB_BACKUP_PASSWORD is required when DB_BACKUP_USER is set}"
fi

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$TARGET_DB" \
  --set=migration_user="$DB_MIGRATION_USER" \
  --set=migration_password="$DB_MIGRATION_PASSWORD" \
  --set=runtime_user="$DB_RUNTIME_USER" \
  --set=runtime_password="$DB_RUNTIME_PASSWORD" \
  --set=backup_user="$BACKUP_USER" \
  --set=backup_password="${DB_BACKUP_PASSWORD:-}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'migration_user', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_user') \gexec
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'runtime_user', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime_user') \gexec
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'backup_user', :'backup_password')
WHERE :'backup_user' <> '' AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'backup_user') \gexec

-- pg_trgm is a trusted extension, but creating one needs CREATE on the
-- database, which the migration role deliberately lacks. Once it exists the
-- baseline migration's CREATE EXTENSION IF NOT EXISTS is a no-op.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', current_database(), :'migration_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_user') \gexec
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'migration_user') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'runtime_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migration_user', :'runtime_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', :'migration_user', :'runtime_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO %I', :'migration_user', :'runtime_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'backup_user') WHERE :'backup_user' <> '' \gexec
SELECT format('GRANT pg_read_all_data TO %I', :'backup_user') WHERE :'backup_user' <> '' \gexec
SQL
