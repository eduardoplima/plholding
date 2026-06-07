# Backend · Fase 008 — Relatórios e Consolidação

## Objetivo
Expor os endpoints de relatório que consolidam receita, despesa, lucro,
patrimônio, dívidas e patrimônio líquido, além de séries para os gráficos do
dashboard. Inclui o CRUD de `Debt`, que ainda não foi exposto.

## Pré-requisitos
- Fases 006 (cobranças/fluxo/inadimplência) e 007 (despesas) concluídas.
- Fase 003 (modelo de `Debt`) concluída.

## Escopo
Endpoints de leitura agregada + CRUD de dívidas. Nada aqui recalcula regras de
negócio das fases anteriores; apenas **consome e agrega** os dados.

## Definições de cálculo (referência: §4 do `CLAUDE.md`)

Para um período `[from, to]` (competência mensal):

- **Receita realizada** = Σ `RentCharge.amount_paid` com `reference_month` no
  período. **Receita esperada** = Σ `amount_due` no período. (Exponha as duas.)
- **Despesa** = Σ `Expense.amount` no período (ofereça recorte por paga/prevista
  conforme `status`/`paid_date`).
- **Lucro** = receita − despesa (deixe claro qual receita: realizada por padrão).
- **Patrimônio** = Σ `Property.market_value` (snapshot atual).
- **Dívidas** = Σ `Debt.outstanding_balance` (snapshot atual).
- **Patrimônio líquido** = patrimônio − dívidas.

> Documente explicitamente, na resposta de cada endpoint, se o número é
> "realizado" ou "esperado/previsto", para não induzir leitura errada.

## Tarefas

1. **CRUD de Dívidas (`routers/debts.py`, `services/debt_service.py`)**
   - `POST /debts`, `GET /debts`, `GET /debts/{id}` (inclui documentos),
     `PATCH /debts/{id}`, `DELETE /debts/{id}`. Escrita `admin`/`manager`.

2. **Endpoints de relatório (`routers/reports.py`)** — leitura para todos os
   papéis:
   - `GET /reports/resultado?from=YYYY-MM&to=YYYY-MM`
     → `{ receita_realizada, receita_esperada, despesa_total, lucro }`.
   - `GET /reports/patrimonio`
     → patrimônio total, dívidas totais, patrimônio líquido, e detalhamento por
       imóvel e por dívida.
   - `GET /reports/fluxo-alugueis?from=YYYY-MM&to=YYYY-MM`
     → série mensal `{ mes, esperado, recebido }` (reusa a lógica da fase 006).
   - `GET /reports/inadimplencia`
     → consolidado por inquilino/contrato: total em atraso, nº de cobranças
       vencidas, dias máximos de atraso (reusa a fase 006).
   - `GET /reports/ocupacao`
     → nº de unidades ocupadas/vagas por imóvel e taxa de ocupação.
   - `GET /reports/dashboard`
     → payload compacto com os principais indicadores para a tela inicial
       (receita do mês, inadimplência total, patrimônio líquido, ocupação,
       contratos vencendo nos próximos 30 dias).

3. **Performance**
   - Use agregações em SQL (não traga tudo para a memória e some em Python).
   - Adicione índices se algum relatório ficar lento (documente).

4. **Consistência monetária**
   - Todos os totais em `Decimal`, serializados como string ou número com 2
     casas, de forma consistente (documente o formato escolhido para o frontend).

5. **Testes**
   - Monte um cenário de dados (alguns contratos pagando, um em atraso, despesas
     em alguns prédios, dívidas e valores de mercado) e verifique cada total.
   - Verifique receita realizada ≠ esperada quando há inadimplência.
   - Verifique patrimônio líquido = patrimônio − dívidas.

## Critérios de aceite
- Cada endpoint retorna os números corretos para o cenário de teste.
- Fica explícito o que é realizado vs. esperado.
- Dívidas têm CRUD completo e entram no patrimônio líquido.
- Agregações feitas em SQL; testes passam; lint/type-check ok.

## Definição de pronto
Camada de relatórios completa, alimentando o dashboard e as telas de resultado/
patrimônio do frontend (fase 007 do frontend).
