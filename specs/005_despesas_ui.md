# Frontend · Fase 005 — Despesas por Prédio (UI)

## Objetivo
Telas para cadastrar e acompanhar despesas (IPTU, energia, água, outros) por
imóvel, registrar pagamentos e anexar comprovantes, consumindo a API da fase
backend 007.

## Pré-requisitos
- Fases frontend 000–003 concluídas (existe a navegação e a lista de imóveis).
- Backend fase 007 disponível; fase 004 (documentos) para anexos.

## Contrato de API (do backend, fase 007)
- `POST /properties/{id}/expenses`, `GET /expenses` (filtros: imóvel, categoria,
  período, status), `PATCH /expenses/{id}`, `POST /expenses/{id}/payment`,
  `DELETE /expenses/{id}`, `GET /despesas/resumo`.

## Tarefas

1. **Hooks de dados** para despesas (listar/criar/editar/remover/pagar) e para o
   resumo por período.

2. **Lista de despesas**
   - Tabela paginada com filtros: imóvel, categoria (IPTU/energia/água/outros),
     intervalo de competência, status. Colunas: imóvel, categoria, competência,
     valor, vencimento, status (badge), pago em.

3. **Cadastro/edição de despesa**
   - Formulário: imóvel, categoria, competência (mês; anual para IPTU conforme
     convenção do backend), valor, vencimento opcional, observações.

4. **Registrar pagamento**
   - Dialog com data de pagamento e **upload opcional de comprovante**
     (`comprovante_imposto` para IPTU, ou `outro` para contas), via fase 004.

5. **Resumo por prédio**
   - Visão (cards ou tabela) com total por imóvel e por categoria no período
     selecionado, alimentada por `GET /despesas/resumo`.

6. **UX e permissões**
   - `viewer` somente leitura; ações de escrita ocultas.
   - Estados de carregamento/vazio/erro e toasts (fase 002).

## Critérios de aceite
- Cadastro de IPTU/energia/água por prédio funciona e aparece na lista.
- Filtros por imóvel/categoria/período funcionam.
- Registro de pagamento atualiza o status e permite anexar comprovante.
- O resumo por prédio bate com o backend.
- Permissões por papel respeitadas; lint e type-check passam.

## Definição de pronto
Gestão de despesas por prédio utilizável, alimentando o relatório de resultado
(fase 007).
