# Frontend · Fase 003 — Inventário e Contratos (UI)

## Objetivo
Telas para gerenciar imóveis, unidades, inquilinos e contratos (com
co-locatários), consumindo a API da fase backend 005.

## Pré-requisitos
- Fases frontend 000–002 concluídas.
- Backend fase 005 disponível (CRUD de properties/units/tenants/leases).

## Contrato de API (do backend, fase 005)
- Properties, Units (aninhadas), Tenants e Leases com seus GET/POST/PATCH/DELETE
  e endpoints de encerramento/cancelamento de contrato. Listas paginadas e
  filtráveis.

## Tarefas

1. **Hooks de dados (`src/api/`)**
   - Crie hooks TanStack Query por recurso (listar, obter, criar, atualizar,
     remover; mutações invalidam as queries certas). Tipados conforme os
     schemas do backend.

2. **Imóveis & Unidades**
   - Lista de imóveis (tabela paginada) com filtro por tipo e busca por nome;
     indicar `rental_mode`.
   - Detalhe do imóvel: dados + lista de unidades (com status ocupado/vago) +
     valor de mercado. Permitir editar o imóvel.
   - Criar/editar imóvel (formulário). Respeitar `rental_mode = whole`
     (orientar o usuário de que terá uma única unidade).
   - Criar/editar/remover unidade dentro do imóvel; refletir a trava do backend
     (não exclui unidade com contrato; mostrar erro 409 de forma amigável).

3. **Inquilinos**
   - Lista (busca por nome/CPF), detalhe (com contratos vinculados), criar/
     editar/remover (bloqueio amigável se houver contrato).

4. **Contratos (Leases)**
   - Lista com filtros: status, imóvel/unidade, inquilino, "vencendo em 30 dias".
   - Criar contrato: selecionar unidade, datas, duração (mostrar `end_date`
     calculada), valor mensal, dia de vencimento (1–28), depósito opcional, e
     **adicionar um ou mais inquilinos** marcando o principal.
   - Detalhe do contrato: dados, inquilinos, e (se já houver a fase 006) um
     resumo de cobranças. Ações: editar, encerrar, cancelar.

5. **UX e permissões**
   - `viewer` enxerga tudo em modo leitura; botões de escrita ocultos/bloqueados.
   - Feedback de sucesso/erro via toast; estados de carregamento/vazio/erro
     usando os componentes da fase 002.
   - Validação de formulário com Zod espelhando as regras do backend.

## Critérios de aceite
- É possível, pela UI, criar e gerenciar todo o inventário e contratos,
  incluindo co-locatários.
- Filtros e paginação funcionam contra a API.
- As travas de integridade do backend aparecem como mensagens claras.
- Permissões por papel são respeitadas na UI.
- Lint e type-check passam.

## Definição de pronto
Gestão de inventário e contratos utilizável, base para a tela de inadimplência
(fase 004) e para anexar documentos (fase 006).
