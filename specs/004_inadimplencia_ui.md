# Frontend · Fase 004 — Cobranças e Inadimplência (UI)

## Objetivo
Telas para visualizar cobranças de aluguel, registrar pagamentos (com anexo de
comprovante), acompanhar a inadimplência e o fluxo de aluguéis recebidos,
consumindo a API da fase backend 006.

## Pré-requisitos
- Fases frontend 000–003 concluídas.
- Backend fase 006 disponível (cobranças, pagamento, inadimplência, fluxo).
- Backend fase 004 (documentos) disponível para o anexo de comprovante.

## Contrato de API (do backend, fase 006)
- `GET /rent-charges` (filtros: status, mês, contrato, inquilino, vencidas).
- `POST /rent-charges/{id}/payment`, `.../reverse`.
- `POST /rent-charges/generate`, `.../recompute` (admin/manager).
- `GET /inadimplencia`, `GET /fluxo-alugueis`.

## Tarefas

1. **Hooks de dados** para cobranças, inadimplência e fluxo (TanStack Query),
   com mutações de pagamento/estorno invalidando as listas e o dashboard.

2. **Tela de Cobranças**
   - Tabela paginada com filtros (mês de competência, status, contrato,
     inquilino, "somente vencidas"). Colunas: inquilino, imóvel/unidade,
     competência, vencimento, valor devido, valor pago, status (badge colorido),
     dias de atraso.
   - Ação **Registrar pagamento**: dialog com valor pago (permitir parcial),
     data de pagamento e **upload opcional de comprovante** (tipo
     `comprovante_pagamento`, via fase 004). Após salvar, atualizar status.
   - Ação **Estornar** (admin/manager), com confirmação.
   - Botões **Gerar cobranças do mês** e **Recalcular status** (admin/manager),
     com feedback do que foi processado.

3. **Painel de Inadimplência**
   - Visão consolidada por inquilino/contrato: total em atraso, nº de cobranças
     vencidas, maior atraso (dias). Ordenável por valor em atraso.
   - Link de cada linha para as cobranças do contrato/inquilino.

4. **Fluxo de aluguéis**
   - Gráfico (Recharts) de série mensal: **esperado vs. recebido** no período
     selecionável (de/até). Tabela de apoio com os valores.

5. **UX e permissões**
   - Status em badges com cores consistentes (pago/parcial/pendente/vencido).
   - `viewer` apenas visualiza; ações de pagamento/estorno/geração ocultas.
   - Estados de carregamento/vazio/erro e toasts (fase 002).

## Critérios de aceite
- A lista de cobranças filtra corretamente e mostra status com cores.
- Registrar pagamento (integral e parcial) atualiza o status e permite anexar
  comprovante; estorno reverte.
- Geração/recálculo manual funcionam e dão feedback.
- O painel de inadimplência bate com os números do backend.
- O gráfico de fluxo mostra esperado vs. recebido corretamente.
- Permissões por papel respeitadas; lint e type-check passam.

## Definição de pronto
Controle de inadimplência e fluxo de aluguéis operacional na UI — entrega
central do sistema do ponto de vista do usuário.
