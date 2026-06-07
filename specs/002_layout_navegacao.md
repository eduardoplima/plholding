# Frontend · Fase 002 — Layout e Navegação

## Objetivo
Construir o "casco" da aplicação: layout autenticado com barra lateral,
navegação entre as áreas do sistema, cabeçalho com usuário/logout e padrões de
estados (carregando, vazio, erro).

## Pré-requisitos
- Fases 000 e 001 do frontend concluídas.

## Tarefas

1. **App shell**
   - Layout com **sidebar** (navegação) + área de conteúdo + topbar.
   - Sidebar com as seções (placeholders por enquanto, ligadas nas próximas
     fases):
     - Dashboard
     - Imóveis & Unidades
     - Inquilinos
     - Contratos
     - Inadimplência
     - Despesas
     - Patrimônio & Dívidas
     - Documentos
     - Usuários (somente `admin`)
   - Itens de navegação visíveis conforme o papel (ex.: "Usuários" só para
     `admin`; ações de escrita ocultas para `viewer`).

2. **Topbar**
   - Nome do usuário atual e menu com "Meu perfil" e "Sair".
   - Indicador de ambiente (dev/prod) opcional.

3. **Padrões reutilizáveis de estado** (componentes compartilhados)
   - `LoadingState` (skeletons do shadcn).
   - `EmptyState` (mensagem + ação opcional).
   - `ErrorState` (mensagem amigável + tentar novamente).
   - `PageHeader` (título + ações à direita).
   - Padrão de **tabela com paginação** reutilizável (envolvendo o Table do
     shadcn) compatível com a paginação do backend (`limit`/`offset`).
   - Padrão de **toast** para sucesso/erro de mutações (Sonner/Toast).

4. **Responsividade**
   - Sidebar colapsável em telas pequenas; conteúdo fluido.

5. **Navegação**
   - Conecte as rotas placeholder das próximas fases ao menu.

## Critérios de aceite
- Usuário autenticado vê o layout com sidebar e topbar funcionais.
- Navegação entre seções funciona; itens respeitam o papel.
- Componentes de estado (loading/empty/error) e a tabela paginada reutilizável
  existem e estão documentados para uso nas próximas fases.
- Layout responsivo em telas pequenas.
- Lint e type-check passam.

## Definição de pronto
Casco navegável e consistente, com blocos de UI reutilizáveis prontos, para
receber as telas de domínio (fases 003–007).
