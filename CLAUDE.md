# CLAUDE.md — P&L Investimentos · Sistema de Gestão Patrimonial e Financeiro

> Este arquivo orienta agentes de IA (e humanos) que vão construir o sistema.
> Leia-o por inteiro antes de executar qualquer fase em `spec/`.

---

## 1. O que é este projeto

Sistema web interno da **P&L Investimentos, Incorporações e Locações LTDA**
(CNPJ 63.509.841/0001-49) para gerir o patrimônio imobiliário e o fluxo
financeiro de aluguéis. O sistema substitui uma planilha que hoje mistura
dados inconsistentes; portanto o sistema é a **fonte de verdade** e deve impor
integridade (datas válidas, valores numéricos, status calculados).

### Objetivos funcionais (escopo acordado)

1. **Inventário de imóveis** organizado em Imóvel → Unidade.
2. **Controle de inquilinos** (locatários), com suporte a co-locatários no mesmo contrato.
3. **Contratos de locação** com início, duração, valor e dia de vencimento.
4. **Controle de inadimplência**: cobranças mensais por contrato, com status
   (pendente / pago / parcial / vencido) e visão de quem está em atraso.
5. **Fluxo de aluguéis recebidos** (entradas mensais, realizadas vs. esperadas).
6. **Despesas por prédio**: IPTU, energia e água (e categoria "outros").
7. **Patrimônio** (valor de mercado dos imóveis) e **dívidas** (financiamentos,
   consignados), para cálculo de patrimônio líquido.
8. **Gestão de documentos**: upload e consulta de comprovantes de pagamento e
   comprovantes de impostos, anexáveis a cobranças, despesas, contratos ou imóveis.
9. **Autenticação de usuários** com papéis (admin / gestor / leitor).
10. **Relatórios** consolidados (receita, despesa, lucro, patrimônio líquido).

### Fora de escopo (NÃO implementar)

- Geração/apuração de impostos a pagar (o sistema apenas guarda comprovantes).
- Emissão de boletos ou integração com gateway de pagamento.
- Conciliação bancária automática.
- App mobile nativo (a UI web deve ser responsiva, mas sem build nativo).

> Se uma fase parecer exigir algo fora de escopo, **pare e registre a dúvida**
> em vez de implementar por conta própria.

---

## 2. Stack técnica

| Camada        | Tecnologia                                                        |
|---------------|-------------------------------------------------------------------|
| Backend       | Python + **FastAPI**                                              |
| ORM           | **SQLAlchemy 2.0** (estilo declarativo tipado) + **Alembic**     |
| Validação     | **Pydantic v2**                                                  |
| Banco         | **PostgreSQL**                                                   |
| Auth          | JWT (access + refresh), hashing de senha com bcrypt/argon2       |
| Armazenamento | **Bucket S3-compatível** (abstração; ver §5)                     |
| Frontend      | **React + TypeScript** (build com Vite)                          |
| Estilo        | **Tailwind CSS** + **shadcn/ui**                                 |
| Dados/estado  | TanStack Query (server state) + React Hook Form + Zod (forms)    |
| Gráficos      | Recharts                                                         |
| Contêineres   | Docker + Docker Compose (Postgres, API, e bucket local p/ dev)   |

### ⚠️ Verificações obrigatórias de versão (NÃO confie em memória)

Algumas ferramentas mudaram recentemente. **Antes de instalar**, o agente deve
checar a documentação oficial atual e fixar (pin) versões no lockfile:

- **Tailwind CSS v4** alterou o formato de configuração (config via CSS em vez de
  `tailwind.config.js`). Confirme na doc oficial qual versão será usada e siga o
  método de setup correspondente. Não assuma a sintaxe da v3.
- **shadcn/ui**: o pacote/CLI já mudou de nome no passado (`shadcn-ui` → `shadcn`).
  Rode `npx shadcn@latest init` somente após confirmar o comando atual na doc, e
  confirme a compatibilidade com a versão de Tailwind escolhida.
- **SQLAlchemy 2.0** e **Pydantic v2** têm APIs diferentes das versões 1.x. Use a
  doc da major escolhida.
- Para qualquer biblioteca: se houver dúvida sobre a assinatura de um método,
  consulte a doc atual; **não invente nomes de função ou parâmetros**.

Registre as versões efetivamente instaladas em `spec/backend/VERSIONS.md` e
`spec/frontend/VERSIONS.md` ao final da fase de setup, para rastreabilidade.

---

## 3. Estrutura do repositório (alvo)

```
.
├── CLAUDE.md                  # este arquivo
├── docker-compose.yml
├── spec/
│   ├── backend/
│   │   ├── 000_setup.md
│   │   ├── 001_auth.md
│   │   ├── 002_modelo_dados_core.md
│   │   ├── 003_modelo_dados_financeiro.md
│   │   ├── 004_documentos_storage.md
│   │   ├── 005_crud_inventario.md
│   │   ├── 006_cobrancas_inadimplencia.md
│   │   ├── 007_despesas.md
│   │   ├── 008_relatorios.md
│   │   └── 009_testes_e_seed.md
│   └── frontend/
│       ├── 000_setup.md
│       ├── 001_auth_ui.md
│       ├── 002_layout_navegacao.md
│       ├── 003_inventario_ui.md
│       ├── 004_inadimplencia_ui.md
│       ├── 005_despesas_ui.md
│       ├── 006_documentos_ui.md
│       ├── 007_dashboard_relatorios.md
│       └── 008_polimento.md
├── backend/                   # criado na fase backend/000
└── frontend/                  # criado na fase frontend/000
```

### Convenção dos arquivos de fase

- Nome: `NNN_nome.md`, executados em **ordem numérica crescente**.
- Cada fase é **sequencial**: assuma que todas as fases anteriores já foram
  concluídas e aprovadas. Não comece uma fase sem as dependências satisfeitas.
- Cada fase contém: **Objetivo**, **Pré-requisitos**, **Escopo**, **Tarefas**,
  **Critérios de aceite** e **Definição de pronto**.
- Backend e frontend podem progredir em paralelo a partir do momento em que os
  contratos de API (`spec/backend/005`–`008`) estiverem definidos. Até lá, faça
  o backend primeiro.

---

## 4. Modelo de dados (visão canônica)

Esta é a referência única do domínio. As fases detalham campos e migrações; em
caso de divergência, **este diagrama lógico prevalece** — e, se algo aqui
estiver ambíguo para o seu caso, pare e pergunte em vez de assumir.

### Princípio estruturante

> **Tudo que pode ser alugado é uma `Unit` que pertence a um `Property`.**
> Imóveis alugados "inteiros" (ex.: uma clínica, um restaurante, um condomínio
> alugado por completo) são modelados como um `Property` com **uma única**
> `Unit` representando o todo. Assim, todo contrato (`Lease`) sempre aponta para
> um `unit_id`, sem polimorfismo.

### Entidades

**User** — usuário do sistema.
- `id`, `email` (único), `hashed_password`, `full_name`,
  `role` ∈ {`admin`, `manager`, `viewer`}, `is_active`, `created_at`, `updated_at`.

**Property** (Imóvel) — unidade-mãe de tudo que é possuído.
- `id`, `name` (ex.: "Condomínio 1", "Clínica Mossoró"),
  `kind` ∈ {`condominio`, `casa`, `fazenda`, `clinica`, `comercial`, `outro`},
  `rental_mode` ∈ {`by_unit`, `whole`},
  `address_line`, `city`, `state`, `cep` (todos opcionais),
  `market_value` (numérico, opcional — para patrimônio),
  `notes`, `created_at`, `updated_at`.

**Unit** (Unidade) — espaço locável dentro de um `Property`.
- `id`, `property_id` (FK), `name` (ex.: "Casa 01", "Unidade 09", "Inteiro"),
  `base_rent` (numérico — aluguel de referência),
  `status` ∈ {`occupied`, `vacant`} (derivado de contrato ativo; ver §6),
  `notes`, `created_at`, `updated_at`.
- Restrição: um `Property` com `rental_mode = whole` tem exatamente uma `Unit`.

**Tenant** (Inquilino/Locatário).
- `id`, `full_name`, `cpf` (opcional, único quando preenchido),
  `email`, `phone`, `notes`, `created_at`, `updated_at`.

**Lease** (Contrato de locação).
- `id`, `unit_id` (FK),
  `start_date` (date), `duration_months` (int),
  `end_date` (date — armazenado, calculado a partir de start + duração),
  `monthly_rent` (numérico — valor contratado, pode diferir do `base_rent`),
  `due_day` (int 1–28 — dia de vencimento mensal),
  `deposit` (numérico, opcional),
  `status` ∈ {`upcoming`, `active`, `ended`, `cancelled`},
  `notes`, `created_at`, `updated_at`.

**LeaseTenant** — associação N:N entre `Lease` e `Tenant` (co-locatários).
- `lease_id` (FK), `tenant_id` (FK), `is_primary` (bool). PK composta.

**RentCharge** (Cobrança de aluguel) — uma parcela mensal por contrato.
- `id`, `lease_id` (FK),
  `reference_month` (date — sempre o 1º dia do mês de competência),
  `due_date` (date),
  `amount_due` (numérico),
  `amount_paid` (numérico, default 0),
  `paid_date` (date, nullable),
  `status` ∈ {`pending`, `paid`, `partial`, `overdue`},
  `notes`, `created_at`, `updated_at`.
- Restrição: `unique(lease_id, reference_month)`.
- É o coração do controle de inadimplência e do fluxo de aluguéis recebidos.

**Expense** (Despesa) — conta por prédio.
- `id`, `property_id` (FK),
  `category` ∈ {`iptu`, `energia`, `agua`, `outros`},
  `reference_period` (date — competência; 1º dia do mês, ou do ano para IPTU),
  `amount` (numérico),
  `due_date` (date, opcional),
  `paid_date` (date, nullable),
  `status` ∈ {`pending`, `paid`, `overdue`},
  `notes`, `created_at`, `updated_at`.

**Debt** (Dívida) — financiamentos e consignados.
- `id`, `name` (ex.: "Financiamento Cond 4"),
  `kind` ∈ {`consignado`, `financiamento`, `outro`},
  `principal_amount` (numérico — valor total/contratado),
  `installment_amount` (numérico, opcional — valor da parcela),
  `outstanding_balance` (numérico — saldo devedor atual),
  `property_id` (FK, opcional — imóvel vinculado),
  `start_date` (date, opcional), `notes`, `created_at`, `updated_at`.

**Document** (Documento) — arquivo no bucket, anexado a algo.
- `id`, `storage_key` (caminho no bucket), `original_filename`,
  `content_type`, `size_bytes`,
  `document_type` ∈ {`comprovante_pagamento`, `comprovante_imposto`, `contrato`, `outro`},
  `owner_entity_type` ∈ {`rent_charge`, `expense`, `lease`, `property`, `debt`},
  `owner_entity_id` (int — id da entidade dona),
  `uploaded_by` (FK User), `created_at`.
- O par (`owner_entity_type`, `owner_entity_id`) é a referência polimórfica.

### Relacionamentos (resumo)

```
User 1───* Document (uploaded_by)
Property 1───* Unit
Property 1───* Expense
Property 1───* Debt (opcional)
Unit 1───* Lease
Lease *───* Tenant   (via LeaseTenant)
Lease 1───* RentCharge
{RentCharge|Expense|Lease|Property|Debt} 1───* Document (polimórfico)
```

### Relatórios derivados (não são tabelas; ver `spec/backend/008`)

- **Receita total**: soma de `RentCharge.amount_paid` no período (realizada) e/ou
  soma de `amount_due` (esperada) — ambas as visões devem existir.
- **Despesa total**: soma de `Expense.amount` (paga e/ou prevista) no período.
- **Lucro**: receita − despesa.
- **Patrimônio**: soma de `Property.market_value`.
- **Dívidas**: soma de `Debt.outstanding_balance`.
- **Patrimônio líquido**: patrimônio − dívidas.
- **Fluxo de aluguéis**: série temporal de recebidos por mês.
- **Inadimplência**: cobranças `overdue`/`partial` agrupadas por contrato/inquilino.

---

## 5. Armazenamento de documentos (bucket)

- Use um **cliente S3-compatível** atrás de uma interface própria
  (`StorageBackend`) com métodos `upload`, `generate_presigned_url`, `delete`.
  Isso permite trocar o provedor sem tocar na regra de negócio.
- **Dev/local**: bucket S3-compatível rodando em contêiner (ex.: MinIO) via
  `docker-compose`. **Produção**: qualquer provedor S3-compatível (config por
  variáveis de ambiente).
- Nunca grave o arquivo no banco; o Postgres guarda apenas metadados +
  `storage_key`.
- Downloads para o usuário devem usar **URL pré-assinada** com expiração curta,
  nunca expondo credenciais.
- Verifique o nome/assinatura exata dos métodos do SDK S3 na doc atual antes de
  usar; não presuma parâmetros.

---

## 6. Regras de negócio centrais

Estas regras valem para todo o sistema e são detalhadas nas fases relevantes.

1. **Status de `Unit`** é derivado: `occupied` se existe `Lease` com
   `status = active` apontando para ela; senão `vacant`. Pode ser materializado
   por trigger/serviço, mas a verdade é o contrato.

2. **`Lease.status`**:
   - `upcoming`: `start_date` no futuro.
   - `active`: hoje entre `start_date` e `end_date`.
   - `ended`: `end_date` no passado.
   - `cancelled`: encerrado manualmente antes do fim.
   - A transição automática (upcoming→active→ended) deve ocorrer via job diário
     e também ser recalculável sob demanda.

3. **Geração de cobranças (`RentCharge`)**: para cada `Lease` `active`, devem
   existir cobranças mensais de `start_date` até o mês corrente. A geração:
   - cria uma `RentCharge` por mês de competência ainda inexistente;
   - `amount_due = Lease.monthly_rent`;
   - `due_date` = dia `due_day` do mês de competência;
   - `status` inicial = `pending`.
   - Idempotente (graças à restrição `unique(lease_id, reference_month)`).

4. **Status de `RentCharge`** (recalculado por job diário e sob demanda):
   - `paid` se `amount_paid >= amount_due`;
   - `partial` se `0 < amount_paid < amount_due`;
   - `overdue` se não pago e `due_date < hoje`;
   - `pending` caso contrário.

5. **Registro de pagamento**: ao registrar, atualiza `amount_paid`, `paid_date`
   e recalcula `status`. Um comprovante (`Document` do tipo
   `comprovante_pagamento`) pode ser anexado.

6. **Inadimplência** = conjunto de `RentCharge` com `status ∈ {overdue, partial}`.

7. **Moeda e números**: todos os valores monetários em `NUMERIC(12,2)`
   (Postgres) / `Decimal` (Python). **Nunca usar float para dinheiro.**

8. **Datas**: armazenar em UTC quando houver timestamp; competências
   (`reference_month`, `reference_period`) são `date` normalizadas ao 1º dia.

9. **Soft delete vs. hard delete**: contratos e cobranças com histórico
   financeiro **não** são apagados fisicamente; use `status = cancelled`/flags.
   Cadastros auxiliares podem ser removidos se sem vínculos.

---

## 7. Convenções de código

### Backend
- Arquitetura em camadas: `models/` (SQLAlchemy) · `schemas/` (Pydantic) ·
  `repositories/` ou `services/` (regra de negócio) · `routers/` (HTTP).
- Toda escrita passa por service; routers não acessam o ORM diretamente para
  lógica complexa.
- Erros de domínio → exceções próprias mapeadas para HTTP (ex.: 404, 409, 422).
- Validação de entrada e saída sempre por schema Pydantic.
- Migrações: **toda** mudança de modelo gera migração Alembic; nunca alterar o
  schema "na mão".
- Tipagem estática habilitada; rode o type checker no CI.

### Frontend
- TypeScript estrito (`strict: true`).
- Estado de servidor exclusivamente via TanStack Query (sem duplicar em estado
  local). Formulários via React Hook Form + Zod.
- Componentes de UI vêm de shadcn/ui; estilização por Tailwind, sem CSS solto.
- Camada de API isolada em `src/api/` (um cliente tipado por recurso).
- Idioma da interface: **português (pt-BR)**. Rótulos, mensagens e datas em
  formato brasileiro (dd/mm/aaaa, R$).

### Geral
- Idioma do domínio em PT, mas **nomes de código (variáveis, tabelas, campos) em
  inglês** conforme o modelo da §4, para consistência técnica.
- Commits pequenos e por fase; cada fase termina com tudo rodando.
- Segredos só em variáveis de ambiente; nunca commitar `.env`.

---

## 8. Glossário PT ⇄ código

| Português              | Entidade/campo no código        |
|------------------------|---------------------------------|
| Imóvel / Prédio        | `Property`                      |
| Unidade / Casa         | `Unit`                          |
| Inquilino / Locatário  | `Tenant`                        |
| Contrato de locação    | `Lease`                         |
| Co-locatário           | `LeaseTenant` (`is_primary`)    |
| Cobrança / Parcela     | `RentCharge`                    |
| Vencimento             | `due_date` / `due_day`          |
| Competência            | `reference_month` / `reference_period` |
| Inadimplência          | cobranças `overdue`/`partial`   |
| Despesa                | `Expense`                       |
| IPTU / Energia / Água  | `Expense.category`              |
| Patrimônio             | `Property.market_value` (soma)  |
| Dívida / Financiamento | `Debt`                          |
| Saldo devedor          | `Debt.outstanding_balance`      |
| Patrimônio líquido     | patrimônio − dívidas (relatório)|
| Comprovante            | `Document`                      |

---

## 9. Como um agente deve trabalhar

1. Leia este `CLAUDE.md` inteiro.
2. Abra a próxima fase pendente (menor `NNN` não concluído) na pasta correta.
3. Confirme os **Pré-requisitos**. Se faltarem, volte à fase anterior.
4. Execute as **Tarefas**, criando código sob `backend/` ou `frontend/`.
5. Valide contra os **Critérios de aceite**. Rode testes/lint/type-check.
6. Se encontrar ambiguidade ou algo fora de escopo, **pare e registre a dúvida**
   (não improvise regra de negócio).
7. Só então avance para a próxima fase.
