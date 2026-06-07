# Backend · Fase 002 — Modelo de Dados (Inventário)

## Objetivo
Criar as entidades do inventário imobiliário: `Property`, `Unit`, `Tenant`,
`Lease` e a associação `LeaseTenant`, com migrações Alembic.

## Pré-requisitos
- Fases 000 e 001 concluídas.

## Escopo
Apenas **modelos + migrações + schemas Pydantic** dessas entidades e os enums.
Endpoints (CRUD) ficam para a fase 005; cobranças/financeiro para 003 e 006.

## Modelos (campos canônicos na §4 do `CLAUDE.md`)

1. **Property**
   - `id`, `name`, `kind` (enum), `rental_mode` (enum `by_unit|whole`),
     `address_line`, `city`, `state`, `cep`, `market_value` (NUMERIC(12,2), null),
     `notes`, timestamps.

2. **Unit**
   - `id`, `property_id` (FK → Property, on delete: restrito), `name`,
     `base_rent` (NUMERIC(12,2)), `status` (enum `occupied|vacant`, default
     `vacant`), `notes`, timestamps.
   - Índice em `property_id`.

3. **Tenant**
   - `id`, `full_name`, `cpf` (null; único quando preenchido), `email`, `phone`,
     `notes`, timestamps.

4. **Lease**
   - `id`, `unit_id` (FK → Unit), `start_date`, `duration_months`,
     `end_date`, `monthly_rent` (NUMERIC(12,2)), `due_day` (int),
     `deposit` (NUMERIC(12,2), null), `status` (enum
     `upcoming|active|ended|cancelled`), `notes`, timestamps.
   - Índices em `unit_id` e `status`.

5. **LeaseTenant** (N:N)
   - `lease_id` (FK), `tenant_id` (FK), `is_primary` (bool). PK composta
     (`lease_id`, `tenant_id`).

## Tarefas

1. Defina todos os enums em local único e reutilizável (PropertyKind,
   RentalMode, UnitStatus, LeaseStatus).
2. Implemente os modelos SQLAlchemy 2.0 (tipados) com relacionamentos:
   - `Property.units` ↔ `Unit.property`
   - `Unit.leases` ↔ `Lease.unit`
   - `Lease.tenants` (via association) ↔ `Tenant.leases`
3. Use `NUMERIC(12,2)` para todos os campos monetários (nunca float).
4. Constraints:
   - `due_day` entre 1 e 28 (check constraint).
   - `cpf` único quando não nulo (índice único parcial).
   - Garanta no nível de serviço (fase 005) que `rental_mode = whole` ⇒ no
     máximo 1 unidade; documente a regra aqui.
5. Gere a migração Alembic única para este conjunto e aplique.
6. Crie os schemas Pydantic de leitura/escrita para cada entidade
   (`PropertyCreate/Read/Update`, idem Unit, Tenant, Lease). Inclua em
   `LeaseRead` a lista de inquilinos associados (com `is_primary`).
7. **Não** implemente lógica de status automática ainda (isso é fase 006); apenas
   deixe os campos prontos e com defaults sensatos.

## Critérios de aceite
- `alembic upgrade head` cria todas as tabelas com as FKs e constraints.
- É possível inserir (via shell/SQL ou teste) um `Property` → `Unit` → `Tenant`
  → `Lease` com co-locatários, respeitando as constraints.
- Schemas serializam corretamente, incluindo a lista de inquilinos no contrato.
- Valores monetários são `Decimal`, não float.
- Lint/type-check passam.

## Definição de pronto
Modelo de inventário persistente e validável, pronto para receber CRUD na
fase 005 e o modelo financeiro na fase 003.
