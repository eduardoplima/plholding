# Frontend · Fase 006 — Documentos (UI)

## Objetivo
Componentes e telas para anexar, listar, visualizar/baixar e remover documentos
(comprovantes de pagamento, comprovantes de imposto, contratos), reutilizáveis a
partir das telas de cobranças, despesas, contratos, imóveis e dívidas.

## Pré-requisitos
- Fases frontend 000–002 concluídas.
- Backend fase 004 (documentos/bucket) disponível.

## Contrato de API (do backend, fase 004)
- `POST /documents` (multipart: arquivo + `document_type`, `owner_entity_type`,
  `owner_entity_id`).
- `GET /documents?owner_entity_type=...&owner_entity_id=...`.
- `GET /documents/{id}/download-url` (URL pré-assinada).
- `DELETE /documents/{id}`.

## Tarefas

1. **Componente reutilizável `DocumentAttachments`**
   - Recebe `owner_entity_type` + `owner_entity_id`.
   - Lista os documentos anexados (nome, tipo, data, tamanho).
   - Botão de **upload** (seleção de arquivo + escolha de `document_type`),
     validando no cliente os tipos aceitos (PDF/imagem) e exibindo erro do
     servidor quando o arquivo for rejeitado.
   - **Visualizar/baixar**: ao clicar, obtém a URL pré-assinada e abre/baixa.
   - **Remover** (admin/manager), com confirmação.
   - Estados de carregamento/vazio/erro e toasts (fase 002).

2. **Integração nas telas existentes**
   - Em **detalhe de cobrança** (fase 004): anexar/ver comprovante de pagamento.
   - Em **detalhe de despesa** (fase 005): anexar/ver comprovante de imposto.
   - Em **detalhe de contrato** (fase 003): anexar/ver o contrato em PDF.
   - Em **detalhe de imóvel** e **dívida** (fase 007): anexar documentos gerais.

3. **(Opcional) Central de documentos**
   - Uma tela que liste documentos por filtro (tipo, entidade), útil para busca
     geral. Só implemente se for simples reusar os hooks; caso contrário,
     registre como melhoria futura.

4. **Permissões**
   - Upload/remoção apenas para `admin`/`manager`; `viewer` apenas visualiza/baixa.

## Critérios de aceite
- O componente `DocumentAttachments` funciona isoladamente e embutido nas telas.
- Upload envia o arquivo + metadados corretos; a lista atualiza.
- Visualizar/baixar usa URL pré-assinada; remover funciona com confirmação.
- Tipos inválidos são barrados (cliente) e o erro do servidor aparece amigável.
- Permissões por papel respeitadas; lint e type-check passam.

## Definição de pronto
Gestão de documentos integrada às entidades do sistema, cobrindo comprovantes de
pagamento e de impostos conforme o escopo.
