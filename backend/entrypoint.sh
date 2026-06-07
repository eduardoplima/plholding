#!/usr/bin/env bash
# Entrypoint de produção: aplica as migrações e sobe a API.
set -e
export PYTHONPATH=/app
echo "[entrypoint] aplicando migrações (alembic upgrade head)…"
alembic upgrade head
echo "[entrypoint] iniciando uvicorn…"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-2}"
