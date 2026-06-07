# Backend · Fase 007 — Despesas por Prédio

## Objetivo
Expor a API de despesas (`Expense`) por imóvel — IPTU, energia, água e "outros"
— com registro de pagamento e anexo de comprovante de imposto.

## Pré-requisitos
- Fase 003 (modelo de `Expense`), fase 005 (existe `Property` via CRUD) e fase
  004 (documentos) concluídas.

## Escopo
CRUD de despesas, registro de pagamento e ligação com comprovantes. Os totais
consolidados por período entram nos relatórios (fase 008).

## Regras de negócio

1. Toda despesa pertence a um `Property` (`property_id` obrigatório).
2. `category` ∈ {`iptu`, `energia`, `agua`, `outros`}.
3. `reference_period` é a competência (1º dia do mês; para IPTU pode ser anual —
   normalize para uma data e documente a convenção adotada).
4. Status: `pending` por padrão; `paid` quando `paid_date` preenchido; `overdue`
   quando `due_date < hoje` e não pago (recalcule sob demanda e, opcionalmente,
   no job diário da fase 006).
5. Um comprovante de imposto/conta é um `Document`
   (`comprovante_imposto` ou `outro`) anexado à despesa (fase 004).

## Tarefas

1. **Service (`services/expense_service.py`)**
   - CRUD completo.
   - `record_payment(expense_id, paid_date, document_id?)`: marca como `paid` e
     opcionalmente vincula comprovante.
   - `recompute_status(...)`: aplica a regra 4 (reaproveite o padrão da fase 006).

2. **Roteador (`routers/expenses.py`)** — escrita `admin`/`manager`, leitura todos.
   - `POST /properties/{property_id}/expenses` (criar para um imóvel).
   - `GET /expenses` com filtros: `property_id`, `category`, intervalo de
     `reference_period`, `status`. Paginado.
   - `GET /expenses/{id}` (inclui documentos anexos).
   - `PATCH /expenses/{id}`.
   - `POST /expenses/{id}/payment` (registrar pagamento).
   - `DELETE /expenses/{id}`.

3. **Consulta de apoio (usada nos relatórios da fase 008, exponha já):**
   - `GET /despesas/resumo?from=YYYY-MM&to=YYYY-MM`: total por `Property` e por
     `category` no período.

4. **Testes**: CRUD; filtros por imóvel/categoria/período; registro de pagamento
   com e sem comprovante; recálculo de `overdue`; autorização por papel.

## Critérios de aceite
- É possível cadastrar IPTU, energia e água por prédio e registrar pagamentos.
- Filtros por imóvel, categoria e período funcionam.
- Comprovante de imposto pode ser anexado a uma despesa.
- `GET /despesas/resumo` retorna os totais corretos.
- Valores em `Decimal`; testes passam; lint/type-check ok.

## Definição de pronto
Despesas por prédio totalmente gerenciáveis, prontas para compor o relatório de
resultado (fase 008) e as telas de despesas (fase 005 do frontend).
