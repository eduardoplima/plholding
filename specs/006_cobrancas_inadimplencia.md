# Backend · Fase 006 — Cobranças, Pagamentos e Inadimplência

## Objetivo
Implementar a lógica central do sistema: geração de cobranças mensais
(`RentCharge`), registro de pagamentos, recálculo automático de status de
cobranças e contratos, e as consultas de inadimplência e de fluxo de aluguéis.

## Pré-requisitos
- Fases 003 (modelo financeiro), 005 (CRUD de contratos) e 004 (documentos)
  concluídas.

## Regras de negócio (referência: §6 do `CLAUDE.md`)

1. **Recálculo de `Lease.status`** (job diário + sob demanda):
   - `upcoming` se `start_date` > hoje; `active` se hoje ∈ [start, end];
     `ended` se `end_date` < hoje; `cancelled` permanece como tal.
2. **Recálculo de `Unit.status`**: `occupied` se há `Lease` `active` na unidade;
   senão `vacant`.
3. **Geração de `RentCharge`** (idempotente):
   - Para cada `Lease` `active`, garantir uma cobrança por mês de competência de
     `start_date` até o mês corrente (inclusive).
   - `amount_due = Lease.monthly_rent`; `due_date` = dia `due_day` do mês de
     competência; `status` inicial `pending`.
   - A constraint `unique(lease_id, reference_month)` garante idempotência.
4. **Recálculo de `RentCharge.status`** (job diário + sob demanda):
   - `paid` se `amount_paid >= amount_due`; `partial` se
     `0 < amount_paid < amount_due`; `overdue` se não pago e `due_date < hoje`;
     senão `pending`.
5. **Registro de pagamento**: atualiza `amount_paid`, `paid_date`, recalcula
   `status`; permite anexar um `Document` `comprovante_pagamento`.
6. **Inadimplência** = cobranças com `status ∈ {overdue, partial}`.

## Tarefas

1. **Service de cobranças (`services/rent_charge_service.py`)**
   - `generate_charges(up_to_month=None)`: aplica a regra 3 para todos os
     contratos ativos (ou um contrato específico). Retorna o que foi criado.
   - `recompute_charge_status(...)` e `recompute_lease_status(...)` e
     `recompute_unit_status(...)`: aplicam as regras 1, 2 e 4.
   - `record_payment(charge_id, payment_input)`: aplica a regra 5; aceita
     `amount_paid`, `paid_date` e `document_id` opcional (documento já enviado
     pela fase 004). Impede pagamento em contrato `cancelled`.
   - `reverse_payment(charge_id)`: estorna (zera pagamento e recalcula), para
     correções; registra em `notes`/log.

2. **Agendador (job diário)**
   - Configure uma tarefa agendada (ex.: APScheduler — confirme a API atual da
     lib antes de usar; **não invente nomes de função**) que, uma vez por dia:
     1) recalcula status de contratos e unidades; 2) gera cobranças do mês
     corrente; 3) recalcula status de cobranças (marca `overdue`).
   - Torne cada passo também acionável por endpoint manual (abaixo), para não
     depender só do agendador em dev.

3. **Roteador (`routers/rent_charges.py`)**
   - `GET /rent-charges` com filtros: `lease_id`, `status`, intervalo de
     `reference_month`, `tenant_id` (via join), vencidas. Paginado.
   - `GET /rent-charges/{id}` (inclui documentos anexos).
   - `POST /rent-charges/{id}/payment` → registra pagamento (regra 5).
   - `POST /rent-charges/{id}/reverse` → estorno.
   - `POST /rent-charges/generate` (admin/manager) → dispara geração manual.
   - `POST /rent-charges/recompute` (admin/manager) → dispara recálculo manual.
   - Escrita = `admin`/`manager`; leitura = todos.

4. **Consultas de apoio (entram em relatórios na fase 008, mas exponha já):**
   - `GET /inadimplencia`: lista de cobranças `overdue`/`partial` agrupadas por
     contrato/inquilino, com total em atraso por inquilino e dias de atraso.
   - `GET /fluxo-alugueis?from=YYYY-MM&to=YYYY-MM`: série mensal com
     `esperado` (soma de `amount_due`) e `recebido` (soma de `amount_paid`).

5. **Testes (críticos — esta é a fase mais sensível):**
   - Geração idempotente: rodar duas vezes não duplica cobranças.
   - Contrato que começou há N meses gera N (ou N+1) cobranças corretas.
   - Recálculo marca `overdue` quando vencida e não paga; `partial` em pagamento
     parcial; `paid` em pagamento integral.
   - Pagamento + estorno revertem corretamente o status.
   - `Unit.status`/`Lease.status` refletem o tempo (use datas controladas no
     teste; não dependa do relógio real sem injeção de "hoje").
   - Inadimplência e fluxo retornam números corretos para um cenário montado.

## Critérios de aceite
- Para um conjunto de contratos de teste, a geração cria exatamente as cobranças
  esperadas e é idempotente.
- Status de cobrança, contrato e unidade são recalculados corretamente por
  endpoint e pelo job.
- Pagamento integral/parcial e estorno produzem os status corretos e permitem
  anexar comprovante.
- `GET /inadimplencia` e `GET /fluxo-alugueis` retornam valores corretos.
- Nenhum cálculo monetário usa float.
- Testes passam; lint/type-check ok.

## Definição de pronto
Núcleo financeiro operante: o sistema sabe quem deve, quanto, desde quando, e
qual o fluxo de aluguéis. Base direta para o dashboard de inadimplência (fase
004 do frontend) e relatórios (fase 008 do backend).
