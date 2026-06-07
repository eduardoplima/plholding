# Backend · Fase 000 — Setup e Fundação

## Objetivo
Criar o esqueleto do backend FastAPI, a conexão com Postgres, o sistema de
migrações Alembic, configuração por ambiente e o ambiente de desenvolvimento em
Docker Compose (API + Postgres + bucket S3-compatível local).

## Pré-requisitos
- Nenhuma fase anterior. É a primeira fase do backend.
- Ter lido o `CLAUDE.md` na raiz, em especial §2 (stack), §5 (bucket) e
  §7 (convenções).

## Escopo
Apenas fundação. **Não** crie ainda modelos de domínio, auth ou endpoints de
negócio — isso vem nas fases seguintes.

## Tarefas

1. **Gerenciador de dependências e projeto Python**
   - Inicialize o projeto em `backend/` com um gerenciador moderno (uv ou
     Poetry — escolha um e documente). Confirme o comando atual na doc oficial.
   - Adicione as dependências base: FastAPI, servidor ASGI (uvicorn), SQLAlchemy
     2.0, Alembic, Pydantic v2, `pydantic-settings`, driver Postgres (psycopg),
     biblioteca de hashing de senha (bcrypt/argon2) e cliente S3-compatível.
   - **Fixe versões no lockfile.** Registre as versões em
     `spec/backend/VERSIONS.md`. Não confie em memória para números de versão.

2. **Estrutura de pastas** (criar vazias/placeholder conforme convenção da §7):
   ```
   backend/
     app/
       __init__.py
       main.py            # cria a app FastAPI
       config.py          # Settings via pydantic-settings
       db.py              # engine, sessionmaker, dependência get_db
       models/__init__.py
       schemas/__init__.py
       services/__init__.py
       routers/__init__.py
       core/__init__.py   # utilidades transversais (segurança vem na fase 001)
     alembic/             # gerado pelo alembic init
     alembic.ini
     pyproject.toml (ou equivalente)
     .env.example
     Dockerfile
   ```

3. **Configuração (`app/config.py`)**
   - Classe `Settings` (pydantic-settings) lendo de variáveis de ambiente:
     `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
     `S3_SECRET_KEY`, `S3_REGION`, `JWT_SECRET` (usado só na fase 001),
     `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `ENV` (dev/prod).
   - Forneça `.env.example` com todas as chaves (sem valores reais).

4. **Camada de banco (`app/db.py`)**
   - Crie o engine SQLAlchemy a partir de `DATABASE_URL`.
   - `sessionmaker` e uma dependência `get_db()` que abre/fecha sessão por
     request.
   - Defina a `Base` declarativa (estilo SQLAlchemy 2.0 tipado) que os modelos
     futuros herdarão.

5. **Alembic**
   - Rode `alembic init` e configure-o para ler a URL de `Settings` e para
     enxergar a metadata da `Base`.
   - Garanta que `alembic revision --autogenerate` e `alembic upgrade head`
     funcionem (mesmo que ainda sem tabelas de negócio).

6. **App FastAPI (`app/main.py`)**
   - Instancie a app, configure CORS (liberando o frontend de dev).
   - Endpoint `GET /health` que responde `{"status": "ok"}` e testa a conexão
     com o banco.
   - Inclua um roteador raiz vazio pronto para receber sub-roteadores.

7. **Docker Compose (na raiz do repo, `docker-compose.yml`)**
   - Serviço `db`: Postgres com volume persistente e variáveis de ambiente.
   - Serviço `storage`: bucket S3-compatível local (ex.: MinIO) com console e
     credenciais de dev; criação automática do bucket de `S3_BUCKET`.
   - Serviço `api`: build do `backend/Dockerfile`, dependente de `db` e
     `storage`, com hot-reload em dev.
   - Documente como subir tudo (`docker compose up`) num `README` curto do
     backend.

8. **Qualidade**
   - Configure linter/formatador (ex.: ruff) e type checker (ex.: mypy ou
     pyright). Adicione um comando único para rodar lint + type-check + testes.
   - Crie `tests/` com um teste mínimo que chama `GET /health`.

## Critérios de aceite
- `docker compose up` sobe `db`, `storage` e `api` sem erro.
- `GET /health` retorna 200 e confirma conexão com o Postgres.
- `alembic upgrade head` roda sem erro contra o banco do compose.
- O bucket de dev é criado automaticamente e está acessível pela API.
- Lint e type-check passam; o teste de `/health` passa.
- `spec/backend/VERSIONS.md` lista as versões instaladas.

## Definição de pronto
Fundação executável e versionada; nenhuma regra de negócio implementada. Pronto
para a fase 001 (autenticação).
