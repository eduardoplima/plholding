# Frontend · Fase 007 — Dashboard, Patrimônio e Relatórios (UI)

## Objetivo
Construir a tela inicial (dashboard) com indicadores e gráficos, a tela de
patrimônio e dívidas (com patrimônio líquido) e o relatório de resultado,
consumindo a API da fase backend 008. Inclui o CRUD de dívidas na UI.

## Pré-requisitos
- Fases frontend 000–002 concluídas (idealmente 003–005 para navegação completa).
- Backend fase 008 disponível (relatórios + CRUD de dívidas).

## Contrato de API (do backend, fase 008)
- `GET /reports/dashboard`, `/reports/resultado`, `/reports/patrimonio`,
  `/reports/fluxo-alugueis`, `/reports/inadimplencia`, `/reports/ocupacao`.
- `GET/POST/PATCH/DELETE /debts`.

## Tarefas

1. **Dashboard (tela inicial)**
   - Cards de indicadores (de `/reports/dashboard`): receita recebida no mês,
     inadimplência total (R$), patrimônio líquido, taxa de ocupação, contratos
     vencendo em 30 dias.
   - Gráfico de **fluxo de aluguéis** (esperado vs. recebido) — Recharts.
   - Bloco de **inadimplência** resumida (top inquilinos em atraso) com link
     para a tela da fase 004.
   - Deixe claro nos rótulos o que é "recebido/realizado" vs. "esperado".

2. **Patrimônio & Dívidas**
   - Visão de patrimônio: total, lista de imóveis com `market_value` (permitir
     editar o valor de mercado do imóvel — reusa o PATCH de imóvel da fase 003).
   - **CRUD de dívidas**: lista, criar/editar/remover (nome, tipo, valor
     principal, parcela, saldo devedor, imóvel vinculado opcional).
   - Cartão de **patrimônio líquido** = patrimônio − dívidas (de
     `/reports/patrimonio`).
   - Permitir anexar documentos a dívidas (componente da fase 006).

3. **Relatório de Resultado**
   - Seletor de período (de/até por mês).
   - Mostrar receita realizada, receita esperada, despesa total e lucro,
     deixando explícita a base de cada número.
   - Detalhamento opcional por imóvel/categoria reaproveitando os resumos das
     fases 006/007.

4. **Ocupação**
   - Visão de unidades ocupadas/vagas por imóvel e taxa de ocupação
     (`/reports/ocupacao`).

5. **UX e permissões**
   - `viewer` vê todos os relatórios (leitura), mas não edita valores de mercado
     nem dívidas.
   - Formatação pt-BR (R$, dd/mm/aaaa); estados de carregamento/vazio/erro.

## Critérios de aceite
- O dashboard mostra os indicadores corretos e o gráfico de fluxo.
- Patrimônio, dívidas e patrimônio líquido batem com o backend; o CRUD de
  dívidas funciona e reflete no patrimônio líquido.
- O relatório de resultado mostra receita (realizada/esperada), despesa e lucro,
  com a base de cada número explícita.
- Ocupação correta.
- Permissões por papel respeitadas; lint e type-check passam.

## Definição de pronto
Camada de visão executiva completa: o usuário enxerga a saúde financeira e
patrimonial do negócio em uma tela. Pronto para o polimento final (fase 008).
