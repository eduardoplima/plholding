# Deploy — app.holdingpl.com.br (Hetzner)

Stack de produção: **Postgres (Docker)** + **API FastAPI** + **Caddy** (HTTPS
automático, serve o frontend e faz proxy de `/api`). Documentos e dados do banco
ficam em **pastas da máquina** (`/opt/plholding`). Tudo via
`docker-compose.prod.yml`.

> A máquina recomendada é uma **Hetzner CX22 (2 vCPU / 4 GB / 40 GB)** — sobra
> folga para o app (uso típico < 1,5 GB).

## 1. Provisionar a VPS
- Crie a VPS (Ubuntu 24.04). Acesse por SSH como root e crie um usuário sudo:
  ```bash
  adduser deploy && usermod -aG sudo deploy
  ```
- Firewall:
  ```bash
  ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
  ```
- Instale Docker + plugin compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker deploy
  ```

## 2. DNS
No painel do domínio `holdingpl.com.br`, crie um registro **A**
`app` → IP da VPS (e **AAAA** se houver IPv6). Aguarde propagar.

## 3. Código + pastas de dados
```bash
sudo mkdir -p /opt/plholding/{storage,pgdata}
sudo chown -R deploy:deploy /opt/plholding
git clone <URL_DO_REPO> /opt/plholding/app
cd /opt/plholding/app
```

## 4. Segredos (.env)
```bash
cp .env.prod.example .env
# edite .env:
#   DATA_DIR=/opt/plholding
#   APP_DOMAIN=app.holdingpl.com.br
#   POSTGRES_PASSWORD=$(openssl rand -hex 32)
#   JWT_SECRET=$(openssl rand -hex 32)
#   ADMIN_PASSWORD=<senha forte>
#   CORS_ORIGINS=https://app.holdingpl.com.br
```

## 5. Subir
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- A API roda `alembic upgrade head` no boot e cria o admin **`eduardo`**.
- O Caddy emite o certificado Let's Encrypt (precisa de 80/443 abertos + DNS já
  apontando). Acompanhe: `docker compose -f docker-compose.prod.yml logs -f web`.
- Acesse **https://app.holdingpl.com.br**, faça login com `eduardo` / `ADMIN_PASSWORD`
  e **troque a senha**.

## 6. Backup semanal → Google Drive (cron)
```bash
sudo apt install -y rclone zip
rclone config           # criar remote "gdrive" (Google Drive, OAuth no navegador)
crontab -e
# domingo 03:00:
0 3 * * 0 cd /opt/plholding/app && DB_CONTAINER=plholding-db LOCAL_STORAGE_DIR=/opt/plholding/storage BACKUP_DIR=/opt/plholding/backups bash backend/scripts/backup.sh >> /opt/plholding/backup.log 2>&1
```
Teste antes: `RCLONE_FLAGS=--dry-run DB_CONTAINER=plholding-db LOCAL_STORAGE_DIR=/opt/plholding/storage bash backend/scripts/backup.sh`

## 7. Atualizar a aplicação
```bash
cd /opt/plholding/app && git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrações rodam no start da API
```

## Operação
- Logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Reiniciar: `docker compose -f docker-compose.prod.yml restart`
- Os dados persistem em `/opt/plholding/{pgdata,storage}` e no volume `caddy_data`
  (certificados). Reboot da VPS sobe tudo (`restart: unless-stopped`).

## Notas de segurança
- Nunca comite o `.env`. O Postgres não expõe porta para fora (só rede interna).
- Mantenha o SO atualizado (`unattended-upgrades`).
- Monitore o disco (documentos + dumps); se necessário, anexe um Volume Hetzner
  montado em `/opt/plholding`.
