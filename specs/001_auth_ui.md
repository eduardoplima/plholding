# Frontend · Fase 001 — Autenticação (UI)

## Objetivo
Implementar login, contexto de autenticação, persistência de sessão, renovação
de token e rotas protegidas com controle por papel.

## Pré-requisitos
- Fase 000 do frontend concluída.
- Backend fase 001 disponível (`/auth/login`, `/auth/refresh`, `/auth/me`).

## Contrato de API (do backend, fase 001)
- `POST /auth/login` → `{ access, refresh, token_type }`.
- `POST /auth/refresh` → novo par de tokens.
- `GET /auth/me` → usuário atual `{ id, email, full_name, role, is_active }`.

## Tarefas

1. **Estado de autenticação**
   - Crie um contexto/hook `useAuth` que expõe: usuário atual, papel,
     `login()`, `logout()`, e estado de carregamento.
   - Persista os tokens de forma segura no cliente. Avalie a estratégia conforme
     a doc/segurança atual (ex.: cookie httpOnly definido pelo backend, ou
     storage com cuidados). Documente a escolha e seus trade-offs; **não assuma**
     um mecanismo sem confirmar a abordagem com o backend.

2. **Página de Login**
   - Formulário (email + senha) com React Hook Form + Zod, componentes shadcn.
   - Mensagens de erro claras (credenciais inválidas, usuário inativo).
   - Estado de carregamento no botão de submit.

3. **Injeção de token e refresh automático**
   - O cliente HTTP (fase 000) deve anexar o access token e, ao receber 401,
     tentar `refresh` uma vez e repetir a requisição; se falhar, deslogar e
     redirecionar para o login.

4. **Rotas protegidas**
   - Componente de rota que exige usuário autenticado; redireciona para login
     se não houver sessão.
   - Suporte a **restrição por papel**: um wrapper que permite exibir/ocultar ou
     bloquear rotas/ações conforme `admin|manager|viewer` (ex.: `viewer` não vê
     botões de escrita). Reaproveitável nas demais fases.

5. **Logout**
   - Limpa a sessão e redireciona ao login.

6. **Tela "Meu perfil" (mínima)**
   - Mostra dados do usuário atual (de `/auth/me`).

## Critérios de aceite
- Login válido autentica e leva à aplicação; inválido mostra erro.
- A sessão persiste ao recarregar a página.
- Requisições autenticadas funcionam; expiração dispara refresh automático e,
  em última instância, logout.
- Rotas e ações respeitam o papel (um `viewer` não acessa telas/ações de
  escrita).
- Lint e type-check passam.

## Definição de pronto
Autenticação completa no frontend, com base de autorização por papel pronta
para reuso em todas as telas seguintes.
