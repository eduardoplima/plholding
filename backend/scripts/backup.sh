#!/usr/bin/env bash
#
# Backup semanal do P&L Holding:
#   1) pg_dump do Postgres (via container Docker) -> dump_<stamp>.sql.gz
#   2) zip da pasta de documentos/imagens          -> documentos_<stamp>.zip
#   3) envia ambos para o Google Drive via rclone
#
# Pré-requisito (uma vez): configurar o remote do rclone
#   rclone config           # criar um remote chamado "gdrive" (tipo: drive / Google Drive)
# Teste manual:
#   bash backend/scripts/backup.sh
# Dry-run (sem enviar nada, só gera os artefatos locais):
#   RCLONE_FLAGS=--dry-run bash backend/scripts/backup.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

STORAGE_DIR="${LOCAL_STORAGE_DIR:-$BACKEND_DIR/storage}"
DB_CONTAINER="${DB_CONTAINER:-plholding-db}"
PG_USER="${POSTGRES_USER:-plholding}"
PG_DB="${POSTGRES_DB:-plholding}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:plholding-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
OUT="${BACKUP_DIR:-$BACKEND_DIR/backups}"
RCLONE_FLAGS="${RCLONE_FLAGS:-}"

STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$OUT/dump_$STAMP.sql.gz"
ZIP="$OUT/documentos_$STAMP.zip"

mkdir -p "$OUT"

echo "[backup] $(date) iniciando"
echo "[backup] pg_dump ($DB_CONTAINER:$PG_DB) -> $DUMP"
docker exec -i "$DB_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$DUMP"

echo "[backup] zip documentos ($STORAGE_DIR) -> $ZIP"
if [ -d "$STORAGE_DIR" ] && [ -n "$(ls -A "$STORAGE_DIR" 2>/dev/null)" ]; then
  ( cd "$STORAGE_DIR" && zip -r -q "$ZIP" . )
else
  echo "[backup] pasta de documentos vazia/ausente — pulando o zip"
  ZIP=""
fi

if command -v rclone >/dev/null 2>&1; then
  echo "[backup] rclone copy -> $RCLONE_REMOTE"
  # shellcheck disable=SC2086
  rclone copy "$DUMP" "$RCLONE_REMOTE/" $RCLONE_FLAGS
  if [ -n "$ZIP" ]; then
    # shellcheck disable=SC2086
    rclone copy "$ZIP" "$RCLONE_REMOTE/" $RCLONE_FLAGS
  fi
  # retenção no Drive
  # shellcheck disable=SC2086
  rclone delete --min-age "${RETENTION_DAYS}d" "$RCLONE_REMOTE/" $RCLONE_FLAGS || true
else
  echo "[backup] rclone não encontrado — artefatos mantidos em $OUT."
  echo "[backup] Configure o rclone ('rclone config', remote 'gdrive') para habilitar o envio ao Drive."
fi

# retenção local
find "$OUT" -type f \( -name '*.sql.gz' -o -name '*.zip' \) -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "[backup] $(date) concluído"
