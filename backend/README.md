# Backend P&L Holding

## Banco de dados (Postgres local)

O Postgres roda em container (serviço `db` do `docker-compose.yml`, host **55432**):

```bash
docker compose up -d db        # na raiz do repo
```

Configuração local em `backend/.env` (copie de `.env.example`):

```
DATABASE_URL=postgresql+psycopg://plholding:plholding@127.0.0.1:55432/plholding
ADMIN_USERNAME=eduardo
ADMIN_PASSWORD=eduardo123
```

> Sem `DATABASE_URL` o app cai em SQLite (`plholding.db`) — usado nos testes.

## Migrações (Alembic)

O schema é versionado por Alembic (`alembic/versions/`). Aplicar/atualizar:

```bash
set -a && . ./.env && set +a
PYTHONPATH=. alembic upgrade head
# após mudar models:
PYTHONPATH=. alembic revision --autogenerate -m "descrição"
```

## Dev rápido

```bash
uv sync
set -a && . ./.env && set +a
uv run uvicorn app.main:app --reload
```

Login: **`eduardo` / `eduardo123`** (admin; troque a senha após o 1º acesso).
Acesso é por **username** (não email).

## Testes

```bash
uv run pytest -q
uv run ruff check .
```

## Backup semanal (Postgres + documentos → Google Drive)

`scripts/backup.sh` faz `pg_dump` (gzip) + zip da pasta `storage/` e envia ambos
para o Google Drive via **rclone**.

Configuração única do rclone:

```bash
brew install rclone        # se necessário
rclone config              # criar remote "gdrive" (tipo Google Drive, OAuth no navegador)
```

Rodar manualmente / dry-run:

```bash
bash scripts/backup.sh
RCLONE_FLAGS=--dry-run bash scripts/backup.sh
```

Agendamento semanal (launchd, domingo 03:00):

```bash
cp scripts/com.plholding.backup.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.plholding.backup.plist
launchctl start com.plholding.backup   # testar
```

Variáveis úteis: `RCLONE_REMOTE` (default `gdrive:plholding-backups`),
`RETENTION_DAYS` (default 90), `LOCAL_STORAGE_DIR`, `DB_CONTAINER`.

## Docker Compose completo (opcional)

```bash
docker compose up --build      # db + minio + api
```
