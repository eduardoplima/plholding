# Backend · Fase 005 — CRUD do Inventário e Contratos (API)

## Objetivo
Expor a API REST para gerenciar `Property`, `Unit`, `Tenant` e `Lease`
(incluindo co-locatários), com as regras de negócio do inventário.

## Pré-requisitos
- Fase 002 (modelos do inventário) e fase 001 (auth/roles) concluídas.

## Escopo
Endpoints de leitura e escrita do inventário. O cálculo automático de status de
contrato/unidade e a geração de cobranças são da fase 006 (mas esta fase deve
deixar ganchos claros).

## Regras de negócio a aplicar aqui

1. `rental_mode = whole` ⇒ o `Property` pode ter **no máximo uma** `Unit`.
   - Ao criar a 2ª unidade num imóvel `whole`, retornar 409.
2. Não permitir excluir um `Property` que tenha `Unit`s, nem uma `Unit` que
   tenha `Lease`s (retornar 409); oriente o uso de cancelamento/encerramento.
3. Ao criar/editar `Lease`:
   - Calcular `end_date` a partir de `start_date` + `duration_months`.
   - Validar `due_day` (1–28).
   - Definir `status` inicial coerente com as datas (`upcoming` se futuro,
     `active` se vigente). O recálculo contínuo é da fase 006.
   - Aceitar a lista de inquilinos (um `is_primary = true`).
4. Encerramento de contrato: endpoint dedicado que muda `status` para
   `ended`/`cancelled` (não apague o histórico).

## Tarefas

1. **Repositórios/Services** para cada entidade, encapsulando as regras acima.
2. **Roteadores** (`routers/properties.py`, `units.py`, `tenants.py`,
   `leases.py`), com papéis: escrita = `admin`/`manager`; leitura = todos.

   **Properties**
   - `POST /properties`, `GET /properties` (com filtros: `kind`, busca por nome),
     `GET /properties/{id}` (inclui unidades), `PATCH /properties/{id}`,
     `DELETE /properties/{id}` (com a trava da regra 2).

   **Units** (aninhadas ao imóvel)
   - `POST /properties/{property_id}/units`,
     `GET /properties/{property_id}/units`,
     `GET /units/{id}`, `PATCH /units/{id}`, `DELETE /units/{id}`.
   - Aplicar a regra 1 (`whole` ⇒ 1 unidade).

   **Tenants**
   - `POST /tenants`, `GET /tenants` (busca por nome/CPF),
     `GET /tenants/{id}` (inclui contratos), `PATCH /tenants/{id}`,
     `DELETE /tenants/{id}` (bloquear se houver contrato vinculado).

   **Leases**
   - `POST /leases` (com lista de inquilinos), `GET /leases`
     (filtros: `status`, `unit_id`, `tenant_id`, vencendo em N dias),
     `GET /leases/{id}` (inclui inquilinos e, opcionalmente, resumo de
     cobranças), `PATCH /leases/{id}`,
     `POST /leases/{id}/end` (encerrar), `POST /leases/{id}/cancel`.

3. **Paginação e ordenação** padronizadas em todos os `GET` de lista
   (ex.: `limit`, `offset`, `order_by`). Documente o padrão e reutilize.

4. **Tratamento de erros** consistente (404 não encontrado, 409 conflito de
   regra, 422 validação), com payload de erro padronizado.

5. **Testes** cobrindo: criação completa imóvel→unidade→inquilino→contrato;
   trava de `whole`; trava de exclusão com vínculos; cálculo de `end_date`;
   encerramento de contrato; autorização por papel.

## Critérios de aceite
- É possível, via API, montar todo o inventário e contratos com co-locatários.
- As travas de integridade (regras 1–4) retornam os códigos corretos.
- `viewer` não consegue escrever; `manager`/`admin` conseguem.
- Listas paginam e filtram; respostas seguem o schema.
- Testes passam; lint/type-check ok.

## Definição de pronto
API de inventário completa e testada, base para a fase 006 (cobranças e
inadimplência) e para as telas do frontend (fase 003 do frontend).
