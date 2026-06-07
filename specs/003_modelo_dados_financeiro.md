# Backend · Fase 003 — Modelo de Dados (Financeiro)

## Objetivo
Criar as entidades financeiras: `RentCharge` (cobranças/parcelas de aluguel),
`Expense` (despesas por prédio) e `Debt` (dívidas), com migrações.

## Pré-requisitos
- Fase 002 concluída (existem `Lease` e `Property`).

## Escopo
Apenas modelos + migrações + schemas. A **lógica** de geração de cobranças,
recálculo de status e registro de pagamento é da fase 006; CRUD de despesas é da
fase 007; relatórios são da fase 008.

## Modelos (campos canônicos na §4 do `CLAUDE.md`)

1. **RentCharge**
   - `id`, `lease_id` (FK → Lease), `reference_month` (date, 1º dia do mês),
     `due_date` (date), `amount_due` (NUMERIC(12,2)),
     `amount_paid` (NUMERIC(12,2), default 0), `paid_date` (date, null),
     `status` (enum `pending|paid|partial|overdue`, default `pending`),
     `notes`, timestamps.
   - Constraint: `unique(lease_id, reference_month)`.
   - Índices em `lease_id`, `status`, `due_date`.

2. **Expense**
   - `id`, `property_id` (FK → Property), `category` (enum
     `iptu|energia|agua|outros`), `reference_period` (date, competência),
     `amount` (NUMERIC(12,2)), `due_date` (date, null),
     `paid_date` (date, null), `status` (enum `pending|paid|overdue`,
     default `pending`), `notes`, timestamps.
   - Índices em `property_id`, `category`, `reference_period`.

3. **Debt**
   - `id`, `name`, `kind` (enum `consignado|financiamento|outro`),
     `principal_amount` (NUMERIC(12,2)), `installment_amount` (NUMERIC(12,2),
     null), `outstanding_balance` (NUMERIC(12,2)),
     `property_id` (FK → Property, null), `start_date` (date, null),
     `notes`, timestamps.

## Tarefas

1. Defina os enums (RentChargeStatus, ExpenseCategory, ExpenseStatus, DebtKind)
   em local único.
2. Implemente os modelos com relacionamentos:
   - `Lease.charges` ↔ `RentCharge.lease`
   - `Property.expenses` ↔ `Expense.property`
   - `Property.debts` ↔ `Debt.property` (opcional)
3. Aplique a constraint `unique(lease_id, reference_month)` (será o que torna a
   geração de cobranças idempotente na fase 006).
4. Todos os valores monetários em `NUMERIC(12,2)` / `Decimal`.
5. Gere e aplique a migração Alembic deste conjunto.
6. Crie schemas Pydantic de leitura/escrita:
   - `RentChargeRead/Update`, `RentChargePaymentInput` (amount_paid, paid_date,
     opcional document_id) — a criação em si é gerada pelo sistema (fase 006),
     não por POST manual livre.
   - `ExpenseCreate/Read/Update`.
   - `DebtCreate/Read/Update`.
7. Documente (sem implementar) que o cálculo de `status` e a geração de
   `RentCharge` pertencem à fase 006, e que relatórios consomem estes dados na
   fase 008.

## Critérios de aceite
- `alembic upgrade head` cria as três tabelas com FKs, enums e a constraint
  única de `RentCharge`.
- Tentar inserir duas `RentCharge` com mesmo (`lease_id`, `reference_month`)
  falha pela constraint.
- Schemas serializam corretamente; valores são `Decimal`.
- Lint/type-check passam.

## Definição de pronto
Modelo financeiro persistente, pronto para a lógica de cobrança/pagamento
(fase 006), CRUD de despesas (fase 007) e relatórios (fase 008).
