# Backend · Fase 001 — Autenticação e Autorização

## Objetivo
Implementar usuários, login com JWT (access + refresh), hashing de senha e
controle de acesso por papel (`admin`, `manager`, `viewer`).

## Pré-requisitos
- Fase 000 concluída (app, db, config, Alembic, Docker funcionando).

## Escopo
Somente identidade e acesso. Não crie ainda entidades de domínio (imóveis etc.).

## Modelo

**User** (ver §4 do `CLAUDE.md`)
- `id` (PK), `email` (único, indexado), `hashed_password`,
  `full_name`, `role` (enum `admin|manager|viewer`),
  `is_active` (bool, default true), `created_at`, `updated_at`.

## Tarefas

1. **Modelo e migração**
   - Crie `models/user.py` com o modelo `User` herdando da `Base`.
   - Gere a migração Alembic e aplique.
   - Defina o enum `UserRole` em um único lugar reutilizável.

2. **Segurança (`app/core/security.py`)**
   - Funções de hash e verificação de senha (bcrypt/argon2 — confirme a API atual
     da biblioteca; **não invente assinaturas**).
   - Geração e verificação de JWT (access curto, refresh longo). Use `JWT_SECRET`
     e `JWT_ALGORITHM` de `Settings`. Confirme na doc da lib de JWT escolhida os
     nomes de função antes de usar.
   - Função para extrair o usuário atual a partir do token (dependência
     `get_current_user`).

3. **Schemas (`schemas/auth.py`, `schemas/user.py`)**
   - `UserCreate` (email, full_name, password, role),
     `UserRead` (sem senha), `UserUpdate`.
   - `LoginRequest`, `TokenPair` (access, refresh, token_type),
     `RefreshRequest`.

4. **Service (`services/user_service.py`, `services/auth_service.py`)**
   - Criar usuário (hash da senha, e-mail único → 409 se duplicado).
   - Autenticar (verifica senha; usuário inativo não loga).
   - Emitir/renovar tokens.

5. **Roteadores**
   - `routers/auth.py`:
     - `POST /auth/login` → `TokenPair`.
     - `POST /auth/refresh` → novo `TokenPair`.
     - `GET /auth/me` → `UserRead` do usuário autenticado.
   - `routers/users.py` (somente `admin`):
     - `POST /users` (criar), `GET /users` (listar), `GET /users/{id}`,
       `PATCH /users/{id}`, `PATCH /users/{id}/deactivate`.

6. **Autorização por papel**
   - Crie dependências reutilizáveis: `require_roles(*roles)`.
   - Regras de papel (referência para fases futuras):
     - `admin`: tudo, incluindo gestão de usuários.
     - `manager`: CRUD de domínio (imóveis, contratos, cobranças, despesas,
       documentos), mas **não** gerencia usuários.
     - `viewer`: somente leitura (GETs e relatórios); nenhuma escrita.
   - Aplique `require_roles` nos endpoints de `users` agora; as fases de domínio
     reaproveitarão essas dependências.

7. **Bootstrap do primeiro admin**
   - Forneça um comando/script (ou seed) para criar o primeiro usuário `admin`
     a partir de variáveis de ambiente, de forma idempotente. Documente-o.

8. **Testes**
   - Login com credenciais válidas/ inválidas; refresh; acesso negado a
     `viewer`/`manager` em rotas de admin; usuário inativo não autentica.

## Critérios de aceite
- Fluxo completo: criar admin → login → usar access token → renovar com refresh.
- `GET /auth/me` retorna o usuário correto.
- Endpoints de `users` exigem papel `admin`; demais papéis recebem 403.
- Senhas nunca trafegam ou são retornadas em respostas.
- Migração aplicável; testes passam; lint/type-check ok.

## Definição de pronto
Autenticação e autorização funcionais e testadas, com dependências
`get_current_user` e `require_roles` prontas para uso nas fases de domínio.
