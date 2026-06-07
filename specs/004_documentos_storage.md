# Backend · Fase 004 — Documentos e Armazenamento (Bucket)

## Objetivo
Implementar o armazenamento de documentos (comprovantes de pagamento, de
impostos, contratos) em bucket S3-compatível, com a entidade `Document` ligada
polimorficamente às entidades de domínio.

## Pré-requisitos
- Fases 002 e 003 concluídas (existem as entidades que podem ter documentos).
- Bucket de dev do `docker-compose` operacional (fase 000).

## Escopo
Abstração de storage + entidade `Document` + endpoints de upload/listagem/
download/exclusão. **Não** acople a regra de cada entidade aqui; apenas o
mecanismo genérico de anexar documentos.

## Modelo (campos canônicos na §4 do `CLAUDE.md`)

**Document**
- `id`, `storage_key`, `original_filename`, `content_type`, `size_bytes`,
  `document_type` (enum `comprovante_pagamento|comprovante_imposto|contrato|outro`),
  `owner_entity_type` (enum `rent_charge|expense|lease|property|debt`),
  `owner_entity_id` (int), `uploaded_by` (FK → User), `created_at`.
- Índice em (`owner_entity_type`, `owner_entity_id`).

## Tarefas

1. **Abstração de storage (`app/services/storage.py`)**
   - Interface `StorageBackend` com:
     - `upload(file_bytes, key, content_type) -> None`
     - `generate_presigned_url(key, expires_seconds) -> str`
     - `delete(key) -> None`
   - Implementação concreta para S3-compatível usando o SDK escolhido na fase
     000. **Confirme os nomes/assinaturas exatos dos métodos do SDK na doc atual
     antes de usar; não presuma parâmetros.**
   - Configuração via `Settings` (endpoint, bucket, chaves, região).

2. **Geração de chave (`storage_key`)**
   - Padrão determinístico e único, ex.:
     `{owner_entity_type}/{owner_entity_id}/{uuid}_{nome_sanitizado}`.
   - Sanitize o nome do arquivo (sem espaços/caracteres problemáticos).

3. **Modelo e migração**
   - Crie `models/document.py` e gere/aplique a migração.

4. **Schemas**
   - `DocumentRead` (inclui URL pré-assinada quando solicitado),
     `DocumentCreateMeta` (document_type, owner_entity_type, owner_entity_id).

5. **Service (`services/document_service.py`)**
   - `create_document(file, meta, user)`: valida que a entidade dona existe
     (lookup por `owner_entity_type` + `owner_entity_id` → 404 se não existir),
     faz upload ao bucket, grava metadados.
   - `list_for_owner(owner_entity_type, owner_entity_id)`.
   - `get_download_url(document_id)` → URL pré-assinada de expiração curta.
   - `delete_document(document_id)`: remove do bucket e do banco.
   - Validações: tamanho máximo de arquivo (configurável) e tipos de conteúdo
     permitidos (PDF e imagens, no mínimo).

6. **Roteador (`routers/documents.py`)**
   - `POST /documents` (multipart: arquivo + metadados) — papéis `admin`/`manager`.
   - `GET /documents?owner_entity_type=...&owner_entity_id=...` — todos os papéis.
   - `GET /documents/{id}/download-url` — retorna URL pré-assinada.
   - `DELETE /documents/{id}` — `admin`/`manager`.
   - Reaproveite `require_roles` da fase 001.

7. **Segurança**
   - Nunca exponha credenciais do bucket ao cliente; downloads sempre via URL
     pré-assinada.
   - Valide content-type e tamanho **no servidor**, não confie no cliente.

8. **Testes**
   - Upload + listagem + obtenção de URL + exclusão, usando o bucket de dev.
   - Upload para entidade inexistente → 404.
   - Tipo de arquivo não permitido → 422/415.

## Critérios de aceite
- Upload grava o objeto no bucket de dev e cria o registro `Document` com
  `storage_key` correto.
- Listagem por dono retorna os documentos certos.
- A URL pré-assinada baixa o arquivo e expira.
- Exclusão remove do bucket e do banco.
- Trocar a implementação de `StorageBackend` não exigiria mudar services de
  domínio (a interface isola o provedor).
- Testes passam; lint/type-check ok.

## Definição de pronto
Mecanismo genérico de documentos operacional, pronto para ser usado por
cobranças (comprovante de pagamento) e despesas (comprovante de imposto) nas
fases 006 e 007, e pela UI na fase 006 do frontend.
