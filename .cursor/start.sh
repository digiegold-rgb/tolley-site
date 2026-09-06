#!/usr/bin/env bash
# Cloud Agent start phase — runs on every boot. Must be idempotent, reconcile
# runtime state, and return (long-running processes belong in `terminals`).
#
# Brings the local PostgreSQL server up and reconciles the schema so the dev
# server (started as a terminal) has a working database whether the pod booted
# from a prebuilt snapshot or was set up just-in-time.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [start] Start PostgreSQL cluster"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> [start] Ensure role 'app' and database 'tagent'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='app'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE app LOGIN PASSWORD 'app';"
sudo -u postgres psql -c "ALTER ROLE app CREATEDB;" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='tagent'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE tagent OWNER app;"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

echo "==> [start] Reconcile Prisma schema"
npx prisma db push --skip-generate --accept-data-loss

echo "==> [start] Ready"
