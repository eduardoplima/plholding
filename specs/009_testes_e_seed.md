# Backend · Fase 009 — Testes, Robustez e Seed

## Objetivo
Fechar o backend com cobertura de testes de integração, endurecimento
(validação, erros, segurança) e dados de seed para desenvolvimento/demonstração.

## Pré-requisitos
- Fases 000–008 concluídas.

## Escopo
Qualidade e operação. Sem novas funcionalidades de negócio.

## Tarefas

1. **Testes de integração ponta a ponta**
   - Suba a app contra um Postgres de teste (contêiner efêmero ou banco de
     teste) e exercite fluxos completos:
     - admin cria usuários → manager cadastra imóveis/unidades/inquilinos/
       contratos → gera cobranças → registra pagamentos (um parcial, um vencido)
       → cadastra despesas e dívidas → consulta relatórios.
   - Verifique os números dos relatórios contra valores esperados calculados à
     mão para o cenário.

2. **Endurecimento**
   - Garanta tratamento uniforme de erros (handler global) com payload
     padronizado e sem vazar stack trace em produção.
   - Revise validações de entrada em todos os schemas (limites de tamanho,
     enums, datas coerentes, `due_day` 1–28, valores ≥ 0 onde aplicável).
   - Confirme que nenhum endpoint de escrita aceita papel `viewer`.
   - Confirme que documentos só são baixados via URL pré-assinada.
   - Configure CORS de produção restritivo (somente origem do frontend).
   - Rate limiting básico no login (anti força-bruta), se viável.

3. **Seed de desenvolvimento (`scripts/seed.py`)**
   - Crie um seed **idempotente** que popule um conjunto realista e **limpo**
     (sem as inconsistências da planilha original): alguns imóveis com unidades,
     inquilinos, contratos ativos/encerrados, cobranças com diferentes status
     (em dia, parcial, vencido), despesas por prédio, dívidas e valores de
     mercado. Inclua um admin de exemplo.
   - O seed serve para o frontend ter dados ao desenvolver. Documente como rodar.

4. **Observabilidade mínima**
   - Logging estruturado com nível configurável por ambiente.
   - O job diário (fase 006) deve logar o que gerou/recalculou.

5. **Documentação da API**
   - Garanta que o OpenAPI gerado pelo FastAPI esteja completo e descritivo
     (summaries, exemplos onde ajudar). O frontend usará isso como contrato.

6. **CI**
   - Pipeline que roda lint + type-check + testes em cada mudança. Documente.

## Critérios de aceite
- Suíte de testes de integração cobre os fluxos principais e passa.
- Erros retornam payload padronizado; nada de stack trace em produção.
- `viewer` não escreve em nenhum endpoint.
- Seed idempotente popula um cenário limpo e coerente; rodar duas vezes não
  duplica dados.
- OpenAPI completo; CI verde.

## Definição de pronto
Backend pronto para produção em termos de qualidade, com dados de seed para
suportar o desenvolvimento e a demonstração do frontend.
