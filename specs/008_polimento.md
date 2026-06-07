# Frontend · Fase 008 — Polimento e Robustez

## Objetivo
Refinar a aplicação: responsividade, acessibilidade básica, consistência visual,
estados de erro/vazio/carregamento em toda parte, e ajustes finais de UX.

## Pré-requisitos
- Fases frontend 000–007 concluídas.

## Tarefas

1. **Consistência visual**
   - Revise espaçamentos, tipografia e cores conforme os tokens definidos na
     fase 000. Padronize badges de status (cores iguais em todas as telas).
   - Garanta uso coerente dos componentes shadcn (sem variações soltas).

2. **Estados em toda a aplicação**
   - Confirme que **toda** lista/tela tem estados de carregamento (skeleton),
     vazio (mensagem útil + ação) e erro (com "tentar novamente").
   - Mutações sempre dão feedback (toast) e tratam erro do servidor de forma
     amigável (inclusive 409/422 com mensagens específicas).

3. **Responsividade**
   - Verifique todas as telas em larguras pequenas; tabelas devem ter scroll
     horizontal ou layout adaptado; a sidebar colapsa.

4. **Acessibilidade básica**
   - Labels em inputs, foco visível, navegação por teclado em dialogs/menus,
     contraste adequado. Use os recursos de acessibilidade que o shadcn já provê.

5. **Desempenho percebido**
   - Revise chaves de cache do TanStack Query e invalidações para evitar
     refetch excessivo ou dados obsoletos após mutações.
   - Considere paginação/virtualização onde listas podem crescer.

6. **Formatação e datas**
   - Confirme R$ e dd/mm/aaaa em todas as telas; nenhuma data ISO crua exposta
     ao usuário.

7. **Revisão de permissões**
   - Passe por cada tela garantindo que `viewer` nunca vê ações de escrita e que
     "Usuários" só aparece para `admin`.

8. **Build de produção**
   - Garanta build de produção sem warnings críticos; variáveis de ambiente
     documentadas; `VITE_API_URL` apontando corretamente.

## Critérios de aceite
- Todas as telas têm estados de loading/empty/error coerentes.
- A aplicação é utilizável e legível em telas pequenas.
- Acessibilidade básica atendida (labels, foco, teclado, contraste).
- Permissões por papel consistentes em toda a UI.
- Build de produção limpo; lint e type-check passam.

## Definição de pronto
Frontend polido, consistente e pronto para uso real pela equipe da P&L
Investimentos.
